-- ============================================================================
-- SCHEMA POSTGRESQL PURO (Opcional — para Railway, Neon, Docker ou Postgres Local)
-- ============================================================================
-- Nota: O frontend estático no GitHub Pages se comunica diretamente com o
-- Supabase (custo zero permanente via API REST + WebSockets + Auth JWT).
-- Este arquivo é fornecido caso você decida hospedar um backend Node.js/API
-- conectado a um PostgreSQL padrão no Railway ou outro provedor no futuro.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE TABLE IF NOT EXISTS perfis_acesso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  perfil perfil_usuario NOT NULL DEFAULT 'CAMBONO',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipe_espiritual (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(120) NOT NULL,
  tipo tipo_membro NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entidades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_entidade VARCHAR(120) NOT NULL,
  linha VARCHAR(80),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS giras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo VARCHAR(150) NOT NULL,
  data_gira DATE NOT NULL DEFAULT CURRENT_DATE,
  status status_gira NOT NULL DEFAULT 'ABERTA',
  aberta_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encerrada_em TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unica_gira_aberta
  ON giras (status)
  WHERE status = 'ABERTA';

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
  ge.id, g.id, g.titulo, g.data_gira, g.status,
  e.id, e.nome_entidade, e.linha, m.id, m.nome, c.id, c.nome,
  ge.limite_senhas, ge.ativo
ORDER BY e.nome_entidade ASC;

