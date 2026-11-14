-- ============================================================================
-- PWA DE GESTÃO DE SENHAS E ATENDIMENTOS DO TERREIRO — RECEPÇÃO IFORITI
-- Script SQL Completo para Supabase (PostgreSQL + Auth + RLS + Realtime + RPC)
-- ============================================================================
-- Execute este script integralmente no SQL Editor do seu projeto Supabase.
-- Ele cria extensões, enums, tabelas, índices, view em tempo real,
-- funções RPC transacionais (FOR UPDATE), políticas RLS e ativa o Realtime.
-- ============================================================================

-- 1. Extensão para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tipos Enumerados (Enums)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'perfil_usuario') THEN
    CREATE TYPE perfil_usuario AS ENUM ('ADMIN', 'CAMBONO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_membro') THEN
    CREATE TYPE tipo_membro AS ENUM ('MEDIUM', 'CAMBONO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_gira') THEN
    CREATE TYPE status_gira AS ENUM ('ABERTA', 'ENCERRADA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_atendimento') THEN
    CREATE TYPE status_atendimento AS ENUM (
      'AGUARDANDO',
      'EM_ATENDIMENTO',
      'ATENDIDO',
      'AUSENTE',
      'NAO_ATENDIDO'
    );
  END IF;
END
$$;

-- 3. Tabela de Perfis Administrativos (vinculada ao auth.users do Supabase)
CREATE TABLE IF NOT EXISTS perfis_acesso (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(160),
  perfil perfil_usuario NOT NULL DEFAULT 'CAMBONO',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Cadastro Base de Médiuns e Cambonos
CREATE TABLE IF NOT EXISTS equipe_espiritual (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(120) NOT NULL,
  tipo tipo_membro NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Cadastro Base de Entidades
CREATE TABLE IF NOT EXISTS entidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_entidade VARCHAR(120) NOT NULL,
  linha VARCHAR(80),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Sessões / Giras do Terreiro
CREATE TABLE IF NOT EXISTS giras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(150) NOT NULL,
  data_gira DATE NOT NULL DEFAULT CURRENT_DATE,
  status status_gira NOT NULL DEFAULT 'ABERTA',
  aberta_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrada_em TIMESTAMPTZ
);

-- Garante RN01: Apenas UMA gira pode estar ABERTA por vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_unica_gira_aberta
  ON giras (status)
  WHERE status = 'ABERTA';

-- 7. Escala e Limites de Senhas por Entidade na Gira
CREATE TABLE IF NOT EXISTS gira_escalas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gira_id UUID NOT NULL REFERENCES giras(id) ON DELETE CASCADE,
  entidade_id UUID NOT NULL REFERENCES entidades(id),
  medium_id UUID NOT NULL REFERENCES equipe_espiritual(id),
  cambono_id UUID REFERENCES equipe_espiritual(id),
  limite_senhas INTEGER NOT NULL CHECK (limite_senhas >= 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Atendimentos / Senhas Emitidas
CREATE TABLE IF NOT EXISTS atendimentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gira_id UUID NOT NULL REFERENCES giras(id) ON DELETE CASCADE,
  escala_id UUID NOT NULL REFERENCES gira_escalas(id) ON DELETE CASCADE,
  numero_senha INTEGER NOT NULL,
  consulente_nome VARCHAR(150) NOT NULL,
  consulente_telefone VARCHAR(30),
  primeira_vez BOOLEAN NOT NULL DEFAULT FALSE,
  status status_atendimento NOT NULL DEFAULT 'AGUARDANDO',
  origem VARCHAR(20) NOT NULL DEFAULT 'QRCODE' CHECK (origem IN ('QRCODE', 'MANUAL')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chamado_em TIMESTAMPTZ,
  hora_atendimento TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_atendimento_escala_numero
  ON atendimentos (escala_id, numero_senha);

CREATE INDEX IF NOT EXISTS idx_atendimentos_gira_escala_status
  ON atendimentos (gira_id, escala_id, status);

CREATE INDEX IF NOT EXISTS idx_atendimentos_criado_em
  ON atendimentos (criado_em DESC);

-- 9. View de Disponibilidade da Gira Aberta em Tempo Real
CREATE OR REPLACE VIEW vw_disponibilidade_gira AS
SELECT
  ge.id AS escala_id,
  g.id AS gira_id,
  g.titulo AS gira_titulo,
  g.data_gira,
  g.status AS gira_status,
  e.id AS entidade_id,
  e.nome_entidade,
  e.linha,
  m.id AS medium_id,
  m.nome AS medium_nome,
  c.id AS cambono_id,
  c.nome AS cambono_nome,
  ge.limite_senhas,
  ge.ativo AS escala_ativa,
  COUNT(a.id)::INTEGER AS senhas_geradas,
  COUNT(a.id) FILTER (WHERE a.status = 'ATENDIDO')::INTEGER AS atendidos,
  COUNT(a.id) FILTER (WHERE a.status = 'AGUARDANDO')::INTEGER AS na_fila,
  COUNT(a.id) FILTER (WHERE a.status = 'EM_ATENDIMENTO')::INTEGER AS em_atendimento,
  COUNT(a.id) FILTER (WHERE a.status = 'AUSENTE')::INTEGER AS ausentes,
  CASE
    WHEN ge.ativo = FALSE THEN 0
    ELSE GREATEST(0, ge.limite_senhas - COUNT(a.id)::INTEGER)
  END AS vagas_restantes
FROM gira_escalas ge
INNER JOIN giras g ON g.id = ge.gira_id
INNER JOIN entidades e ON e.id = ge.entidade_id
INNER JOIN equipe_espiritual m ON m.id = ge.medium_id
LEFT JOIN equipe_espiritual c ON c.id = ge.cambono_id
LEFT JOIN atendimentos a ON a.escala_id = ge.id
WHERE g.status = 'ABERTA'
GROUP BY
  ge.id,
  g.id,
  g.titulo,
  g.data_gira,
  g.status,
  e.id,
  e.nome_entidade,
  e.linha,
  m.id,
  m.nome,
  c.id,
  c.nome,
  ge.limite_senhas,
  ge.ativo
ORDER BY e.nome_entidade ASC;

GRANT SELECT ON vw_disponibilidade_gira TO anon, authenticated;

-- 10. Função Auxiliar de Verificação de Perfil
CREATE OR REPLACE FUNCTION is_equipe_ativa()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM perfis_acesso
    WHERE id = auth.uid()
      AND ativo = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION is_admin_ativo()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM perfis_acesso
    WHERE id = auth.uid()
      AND ativo = TRUE
      AND perfil = 'ADMIN'
  );
$$;

-- 11. Função RPC Transacional: Gerar Senha do Consulente (RNF03 + RNF04)
-- Bloqueio pessimista FOR UPDATE impede ultrapassar a última vaga sob concorrência.
CREATE OR REPLACE FUNCTION gerar_senha_consulente(
  p_escala_id UUID,
  p_nome VARCHAR,
  p_telefone VARCHAR DEFAULT NULL,
  p_primeira_vez BOOLEAN DEFAULT FALSE,
  p_origem VARCHAR DEFAULT 'QRCODE'
)
RETURNS TABLE (
  atendimento_id UUID,
  gira_id UUID,
  escala_id UUID,
  numero_senha INTEGER,
  status status_atendimento,
  consulente_nome VARCHAR,
  consulente_telefone VARCHAR,
  primeira_vez BOOLEAN,
  origem VARCHAR,
  gira_titulo VARCHAR,
  data_gira DATE,
  nome_entidade VARCHAR,
  linha VARCHAR,
  medium_nome VARCHAR,
  criado_em TIMESTAMPTZ,
  ja_existia BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escala gira_escalas%ROWTYPE;
  v_gira giras%ROWTYPE;
  v_entidade entidades%ROWTYPE;
  v_medium equipe_espiritual%ROWTYPE;
  v_existente atendimentos%ROWTYPE;
  v_novo atendimentos%ROWTYPE;
  v_total_geradas INTEGER;
  v_prox_numero INTEGER;
  v_telefone_limpo TEXT;
  v_origem_norm VARCHAR(20);
BEGIN
  IF TRIM(COALESCE(p_nome, '')) = '' THEN
    RAISE EXCEPTION 'NOME_OBRIGATORIO: Informe o nome completo do consulente.';
  END IF;

  v_origem_norm := CASE
    WHEN UPPER(TRIM(COALESCE(p_origem, 'QRCODE'))) = 'MANUAL' THEN 'MANUAL'
    ELSE 'QRCODE'
  END;

  -- Bloqueio pessimista na linha da escala (RNF03)
  SELECT *
    INTO v_escala
    FROM gira_escalas
   WHERE id = p_escala_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ESCALA_NAO_ENCONTRADA: Entidade não localizada na escala atual.';
  END IF;

  SELECT *
    INTO v_gira
    FROM giras
   WHERE id = v_escala.gira_id;

  IF NOT FOUND OR v_gira.status <> 'ABERTA' THEN
    RAISE EXCEPTION 'GIRA_ENCERRADA: Não há gira aberta no momento para emissão de senhas.';
  END IF;

  SELECT * INTO v_entidade FROM entidades WHERE id = v_escala.entidade_id;
  SELECT * INTO v_medium FROM equipe_espiritual WHERE id = v_escala.medium_id;

  v_telefone_limpo := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');

  -- Prevenção de Duplicidade (RNF04): recupera comprovante existente para o mesmo telefone na mesma entidade/gira
  IF v_origem_norm = 'QRCODE' AND LENGTH(v_telefone_limpo) >= 8 THEN
    SELECT *
      INTO v_existente
      FROM atendimentos a
     WHERE a.gira_id = v_gira.id
       AND a.escala_id = v_escala.id
       AND regexp_replace(COALESCE(a.consulente_telefone, ''), '\D', '', 'g') = v_telefone_limpo
     ORDER BY a.criado_em DESC
     LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
      SELECT
        v_existente.id,
        v_gira.id,
        v_escala.id,
        v_existente.numero_senha,
        v_existente.status,
        v_existente.consulente_nome,
        v_existente.consulente_telefone,
        v_existente.primeira_vez,
        v_existente.origem,
        v_gira.titulo,
        v_gira.data_gira,
        v_entidade.nome_entidade,
        v_entidade.linha,
        v_medium.nome,
        v_existente.criado_em,
        TRUE;
      RETURN;
    END IF;
  END IF;

  -- Verifica se a escala está ativa (RF04)
  IF v_escala.ativo = FALSE THEN
    RAISE EXCEPTION 'ESCALA_PAUSADA: As senhas para esta entidade estão temporariamente pausadas.';
  END IF;

  -- Conta senhas já emitidas para validar o limite
  SELECT COUNT(*)::INTEGER, COALESCE(MAX(a.numero_senha), 0)::INTEGER
    INTO v_total_geradas, v_prox_numero
    FROM atendimentos a
   WHERE a.escala_id = v_escala.id;

  IF v_total_geradas >= v_escala.limite_senhas THEN
    RAISE EXCEPTION 'ESGOTADO: As senhas para esta entidade já esgotaram.';
  END IF;

  v_prox_numero := v_prox_numero + 1;

  INSERT INTO atendimentos (
    gira_id,
    escala_id,
    numero_senha,
    consulente_nome,
    consulente_telefone,
    primeira_vez,
    status,
    origem
  )
  VALUES (
    v_gira.id,
    v_escala.id,
    v_prox_numero,
    TRIM(p_nome),
    NULLIF(TRIM(COALESCE(p_telefone, '')), ''),
    COALESCE(p_primeira_vez, FALSE),
    'AGUARDANDO',
    v_origem_norm
  )
  RETURNING * INTO v_novo;

  RETURN QUERY
  SELECT
    v_novo.id,
    v_gira.id,
    v_escala.id,
    v_novo.numero_senha,
    v_novo.status,
    v_novo.consulente_nome,
    v_novo.consulente_telefone,
    v_novo.primeira_vez,
    v_novo.origem,
    v_gira.titulo,
    v_gira.data_gira,
    v_entidade.nome_entidade,
    v_entidade.linha,
    v_medium.nome,
    v_novo.criado_em,
    FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION gerar_senha_consulente(UUID, VARCHAR, VARCHAR, BOOLEAN, VARCHAR) TO anon, authenticated;

-- 12. RPC RF10: Marcar Ausente e opcionalmente liberar +1 vaga
CREATE OR REPLACE FUNCTION marcar_ausente_atendimento(
  p_atendimento_id UUID,
  p_liberar_vaga BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atendimento atendimentos%ROWTYPE;
BEGIN
  IF NOT is_equipe_ativa() THEN
    RAISE EXCEPTION 'NAO_AUTORIZADO: Apenas membros ativos da equipe podem marcar ausência.';
  END IF;

  SELECT *
    INTO v_atendimento
    FROM atendimentos
   WHERE id = p_atendimento_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATENDIMENTO_NAO_ENCONTRADO';
  END IF;

  UPDATE atendimentos
     SET status = 'AUSENTE'
   WHERE id = p_atendimento_id;

  IF p_liberar_vaga THEN
    UPDATE gira_escalas
       SET limite_senhas = limite_senhas + 1
     WHERE id = v_atendimento.escala_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION marcar_ausente_atendimento(UUID, BOOLEAN) TO authenticated;

-- 13. RPC RN03: Encerrar Gira (converte AGUARDANDO -> NAO_ATENDIDO e fecha gira)
CREATE OR REPLACE FUNCTION encerrar_gira(p_gira_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_ativo() THEN
    RAISE EXCEPTION 'NAO_AUTORIZADO: Apenas administradores ativos podem encerrar a gira.';
  END IF;

  UPDATE atendimentos
     SET status = 'NAO_ATENDIDO'
   WHERE gira_id = p_gira_id
     AND status = 'AGUARDANDO';

  UPDATE giras
     SET status = 'ENCERRADA',
         encerrada_em = NOW()
   WHERE id = p_gira_id
     AND status = 'ABERTA';
END;
$$;

GRANT EXECUTE ON FUNCTION encerrar_gira(UUID) TO authenticated;

-- 14. Políticas de Segurança RLS (Row Level Security)
ALTER TABLE perfis_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipe_espiritual ENABLE ROW LEVEL SECURITY;
ALTER TABLE entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE giras ENABLE ROW LEVEL SECURITY;
ALTER TABLE gira_escalas ENABLE ROW LEVEL SECURITY;
ALTER TABLE atendimentos ENABLE ROW LEVEL SECURITY;

-- perfis_acesso
DROP POLICY IF EXISTS "perfis_leitura_proprio_ou_admin" ON perfis_acesso;
CREATE POLICY "perfis_leitura_proprio_ou_admin" ON perfis_acesso
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin_ativo());

DROP POLICY IF EXISTS "perfis_admin_gerencia" ON perfis_acesso;
CREATE POLICY "perfis_admin_gerencia" ON perfis_acesso
  FOR ALL TO authenticated
  USING (is_admin_ativo())
  WITH CHECK (is_admin_ativo());

-- equipe_espiritual
DROP POLICY IF EXISTS "equipe_leitura_publica" ON equipe_espiritual;
CREATE POLICY "equipe_leitura_publica" ON equipe_espiritual
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "equipe_admin_gerencia" ON equipe_espiritual;
CREATE POLICY "equipe_admin_gerencia" ON equipe_espiritual
  FOR ALL TO authenticated
  USING (is_admin_ativo())
  WITH CHECK (is_admin_ativo());

-- entidades
DROP POLICY IF EXISTS "entidades_leitura_publica" ON entidades;
CREATE POLICY "entidades_leitura_publica" ON entidades
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "entidades_admin_gerencia" ON entidades;
CREATE POLICY "entidades_admin_gerencia" ON entidades
  FOR ALL TO authenticated
  USING (is_admin_ativo())
  WITH CHECK (is_admin_ativo());

-- giras
DROP POLICY IF EXISTS "giras_leitura_publica" ON giras;
CREATE POLICY "giras_leitura_publica" ON giras
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "giras_admin_gerencia" ON giras;
CREATE POLICY "giras_admin_gerencia" ON giras
  FOR ALL TO authenticated
  USING (is_admin_ativo())
  WITH CHECK (is_admin_ativo());

-- gira_escalas
DROP POLICY IF EXISTS "escalas_leitura_publica" ON gira_escalas;
CREATE POLICY "escalas_leitura_publica" ON gira_escalas
  FOR SELECT TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "escalas_admin_gerencia" ON gira_escalas;
CREATE POLICY "escalas_admin_gerencia" ON gira_escalas
  FOR ALL TO authenticated
  USING (is_admin_ativo())
  WITH CHECK (is_admin_ativo());

DROP POLICY IF EXISTS "escalas_cambono_atualiza_limite" ON gira_escalas;
CREATE POLICY "escalas_cambono_atualiza_limite" ON gira_escalas
  FOR UPDATE TO authenticated
  USING (is_equipe_ativa())
  WITH CHECK (is_equipe_ativa());

-- atendimentos
-- Leitura para anon permitida na gira ABERTA para suportar Realtime no comprovante (/senha)
DROP POLICY IF EXISTS "atendimentos_leitura_gira_aberta_ou_equipe" ON atendimentos;
CREATE POLICY "atendimentos_leitura_gira_aberta_ou_equipe" ON atendimentos
  FOR SELECT TO anon, authenticated
  USING (
    is_equipe_ativa()
    OR EXISTS (
      SELECT 1 FROM giras g
      WHERE g.id = atendimentos.gira_id
        AND g.status = 'ABERTA'
    )
  );

DROP POLICY IF EXISTS "atendimentos_equipe_atualiza" ON atendimentos;
CREATE POLICY "atendimentos_equipe_atualiza" ON atendimentos
  FOR UPDATE TO authenticated
  USING (is_equipe_ativa())
  WITH CHECK (is_equipe_ativa());

DROP POLICY IF EXISTS "atendimentos_admin_deleta" ON atendimentos;
CREATE POLICY "atendimentos_admin_deleta" ON atendimentos
  FOR DELETE TO authenticated
  USING (is_admin_ativo());

-- 15. Habilitar Supabase Realtime nas tabelas da fila ao vivo
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE atendimentos;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE gira_escalas;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE giras;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END
$$;

-- ============================================================================
-- 16. Dados Iniciais Idempotentes e Vínculo Automático de Perfis
-- ============================================================================
INSERT INTO equipe_espiritual (nome, tipo)
SELECT v.nome, v.tipo::tipo_membro
FROM (
  VALUES
    ('Pai João', 'MEDIUM'),
    ('Mãe Clara', 'MEDIUM'),
    ('Médium Carlos', 'MEDIUM'),
    ('Cambono Lucas', 'CAMBONO'),
    ('Cambona Mariana', 'CAMBONO')
) AS v(nome, tipo)
WHERE NOT EXISTS (
  SELECT 1 FROM equipe_espiritual e WHERE e.nome = v.nome
);

INSERT INTO entidades (nome_entidade, linha)
SELECT v.nome_entidade, v.linha
FROM (
  VALUES
    ('Caboclo Sete Flechas', 'Caboclos'),
    ('Cabocla Jurema', 'Caboclos'),
    ('Vovó Maria Conga', 'Pretos Velhos'),
    ('Caboclo Pena Branca', 'Caboclos')
) AS v(nome_entidade, linha)
WHERE NOT EXISTS (
  SELECT 1 FROM entidades ent WHERE ent.nome_entidade = v.nome_entidade
);

INSERT INTO perfis_acesso (id, nome, email, perfil, ativo)
SELECT
  u.id,
  CASE
    WHEN LOWER(u.email) = 'admin@terreiro.org' THEN 'Dirigente / Administrador'
    ELSE 'Cambono de Plantão'
  END,
  u.email,
  CASE
    WHEN LOWER(u.email) = 'admin@terreiro.org' THEN 'ADMIN'::perfil_usuario
    ELSE 'CAMBONO'::perfil_usuario
  END,
  TRUE
FROM auth.users u
WHERE LOWER(u.email) IN ('admin@terreiro.org', 'cambono@terreiro.org')
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  perfil = EXCLUDED.perfil,
  ativo = TRUE;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_papel perfil_usuario;
  v_nome VARCHAR(100);
BEGIN
  IF LOWER(COALESCE(NEW.email, '')) = 'admin@terreiro.org'
     OR NOT EXISTS (
       SELECT 1 FROM public.perfis_acesso WHERE perfil = 'ADMIN' AND ativo = TRUE
     ) THEN
    v_papel := 'ADMIN';
    v_nome := COALESCE(NULLIF(NEW.raw_user_meta_data->>'nome', ''), 'Dirigente / Administrador');
  ELSE
    v_papel := 'CAMBONO';
    v_nome := COALESCE(NULLIF(NEW.raw_user_meta_data->>'nome', ''), 'Cambono de Plantão');
  END IF;

  INSERT INTO public.perfis_acesso (id, nome, email, perfil, ativo)
  VALUES (NEW.id, v_nome, NEW.email, v_papel, TRUE)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    ativo = TRUE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
