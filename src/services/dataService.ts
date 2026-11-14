import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { limparDigitos } from '../lib/format';
import type {
  Atendimento,
  AtendimentoDetalhado,
  ComprovanteSenha,
  DisponibilidadeGira,
  Entidade,
  EquipeEspiritual,
  EscalaNovaInput,
  FiltroRelatorio,
  Gira,
  GiraEscala,
  OrigemCheckin,
  PerfilAcesso,
  StatusAtendimento,
  TipoMembro,
} from '../types/database';

// ============================================================================
// MOTOR LOCAL RESILIENTE (ativado automaticamente quando Supabase não está configurado)
// Usa localStorage + BroadcastChannel para sincronização ao vivo entre abas.
// ============================================================================

const LOCAL_DB_KEY = 'iforiti_local_db_v2';
const BROADCAST_CHANNEL_NAME = 'iforiti_realtime_v1';

interface LocalDatabase {
  perfis_acesso: PerfilAcesso[];
  equipe_espiritual: EquipeEspiritual[];
  entidades: Entidade[];
  giras: Gira[];
  gira_escalas: GiraEscala[];
  atendimentos: Atendimento[];
}

function gerarUuidLocal(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function criarSeedLocal(): LocalDatabase {
  const agora = new Date().toISOString();

  const med1 = '11111111-1111-4111-8111-111111111101';
  const med2 = '11111111-1111-4111-8111-111111111102';
  const med3 = '11111111-1111-4111-8111-111111111103';
  const cam1 = '11111111-1111-4111-8111-111111111104';
  const cam2 = '11111111-1111-4111-8111-111111111105';

  const ent1 = '22222222-2222-4222-8222-222222222201';
  const ent2 = '22222222-2222-4222-8222-222222222202';
  const ent3 = '22222222-2222-4222-8222-222222222203';
  const ent4 = '22222222-2222-4222-8222-222222222204';

  return {
    perfis_acesso: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        nome: 'Administrador do Terreiro',
        email: 'admin@terreiro.org',
        perfil: 'ADMIN',
        ativo: true,
        criado_em: agora,
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        nome: 'Cambono Recepção',
        email: 'cambono@terreiro.org',
        perfil: 'CAMBONO',
        ativo: true,
        criado_em: agora,
      },
    ],
    equipe_espiritual: [
      { id: med1, nome: 'Pai João', tipo: 'MEDIUM', ativo: true, criado_em: agora },
      { id: med2, nome: 'Mãe Clara', tipo: 'MEDIUM', ativo: true, criado_em: agora },
      { id: med3, nome: 'Médium Carlos', tipo: 'MEDIUM', ativo: true, criado_em: agora },
      { id: cam1, nome: 'Cambono Lucas', tipo: 'CAMBONO', ativo: true, criado_em: agora },
      { id: cam2, nome: 'Cambona Mariana', tipo: 'CAMBONO', ativo: true, criado_em: agora },
    ],
    entidades: [
      { id: ent1, nome_entidade: 'Caboclo Sete Flechas', linha: 'Caboclos', ativo: true, criado_em: agora },
      { id: ent2, nome_entidade: 'Cabocla Jurema', linha: 'Caboclos', ativo: true, criado_em: agora },
      { id: ent3, nome_entidade: 'Vovó Maria Conga', linha: 'Pretos Velhos', ativo: true, criado_em: agora },
      { id: ent4, nome_entidade: 'Caboclo Pena Branca', linha: 'Caboclos', ativo: true, criado_em: agora },
    ],
    // Registros e senhas só são permitidos após o Administrador abrir a gira no sistema
    giras: [],
    gira_escalas: [],
    atendimentos: [],
  };
}

function lerLocalDb(): LocalDatabase {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (!raw) {
      const seed = criarSeedLocal();
      localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as LocalDatabase;
  } catch {
    const seed = criarSeedLocal();
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(seed));
    return seed;
  }
}

const localListeners = new Set<() => void>();
let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.onmessage = () => {
      localListeners.forEach((fn) => fn());
    };
  }
  return broadcastChannel;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_DB_KEY) {
      localListeners.forEach((fn) => fn());
    }
  });
}

function salvarLocalDb(db: LocalDatabase): void {
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  localListeners.forEach((fn) => fn());
  try {
    getBroadcastChannel()?.postMessage({ type: 'DB_UPDATED', at: Date.now() });
  } catch {
    // Ignore
  }
}

function subscribeLocalRealtime(callback: () => void): () => void {
  getBroadcastChannel();
  localListeners.add(callback);
  return () => {
    localListeners.delete(callback);
  };
}

export function resetarBancoLocalDemonstracao(): void {
  const seed = criarSeedLocal();
  salvarLocalDb(seed);
}

// ============================================================================
// FUNÇÕES PÚBLICAS DO SERVIÇO DE DADOS (Dual-Mode: Supabase ou Motor Local)
// ============================================================================

export async function getDisponibilidadeGiraAberta(): Promise<DisponibilidadeGira[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('vw_disponibilidade_gira')
      .select('*')
      .order('nome_entidade', { ascending: true });

    if (error) throw error;
    return (data ?? []) as DisponibilidadeGira[];
  }

  const db = lerLocalDb();
  const giraAberta = db.giras.find((g) => g.status === 'ABERTA');
  if (!giraAberta) return [];

  return db.gira_escalas
    .filter((ge) => ge.gira_id === giraAberta.id)
    .map((ge) => {
      const entidade = db.entidades.find((e) => e.id === ge.entidade_id);
      const medium = db.equipe_espiritual.find((m) => m.id === ge.medium_id);
      const cambono = db.equipe_espiritual.find((c) => c.id === ge.cambono_id);
      const atds = db.atendimentos.filter((a) => a.escala_id === ge.id);

      const senhas_geradas = atds.length;
      const atendidos = atds.filter((a) => a.status === 'ATENDIDO').length;
      const na_fila = atds.filter((a) => a.status === 'AGUARDANDO').length;
      const em_atendimento = atds.filter((a) => a.status === 'EM_ATENDIMENTO').length;
      const ausentes = atds.filter((a) => a.status === 'AUSENTE').length;
      const vagas_restantes = !ge.ativo ? 0 : Math.max(0, ge.limite_senhas - senhas_geradas);

      return {
        escala_id: ge.id,
        gira_id: giraAberta.id,
        gira_titulo: giraAberta.titulo,
        data_gira: giraAberta.data_gira,
        gira_status: giraAberta.status,
        entidade_id: ge.entidade_id,
        nome_entidade: entidade?.nome_entidade ?? 'Entidade',
        linha: entidade?.linha ?? null,
        medium_id: ge.medium_id,
        medium_nome: medium?.nome ?? 'Médium',
        cambono_id: ge.cambono_id,
        cambono_nome: cambono?.nome ?? null,
        limite_senhas: ge.limite_senhas,
        escala_ativa: ge.ativo,
        senhas_geradas,
        atendidos,
        na_fila,
        em_atendimento,
        ausentes,
        vagas_restantes,
      } satisfies DisponibilidadeGira;
    })
    .sort((a, b) => a.nome_entidade.localeCompare(b.nome_entidade));
}

export async function gerarSenhaConsulente(params: {
  escalaId: string;
  nome: string;
  telefone?: string;
  primeiraVez: boolean;
  origem?: OrigemCheckin;
}): Promise<ComprovanteSenha> {
  const origem: OrigemCheckin = params.origem ?? 'QRCODE';

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc('gerar_senha_consulente', {
      p_escala_id: params.escalaId,
      p_nome: params.nome.trim(),
      p_telefone: params.telefone?.trim() || null,
      p_primeira_vez: params.primeiraVez,
      p_origem: origem,
    });

    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error('Não foi possível gerar a senha. Tente novamente.');
    }
    return row as ComprovanteSenha;
  }

  const db = lerLocalDb();
  const escala = db.gira_escalas.find((e) => e.id === params.escalaId);
  if (!escala) throw new Error('ESCALA_NAO_ENCONTRADA');

  const gira = db.giras.find((g) => g.id === escala.gira_id);
  if (!gira || gira.status !== 'ABERTA') {
    throw new Error('GIRA_ENCERRADA');
  }

  const entidade = db.entidades.find((e) => e.id === escala.entidade_id);
  const medium = db.equipe_espiritual.find((m) => m.id === escala.medium_id);
  const telLimpo = limparDigitos(params.telefone ?? '');

  if (origem === 'QRCODE' && telLimpo.length >= 8) {
    const existente = db.atendimentos.find(
      (a) =>
        a.gira_id === gira.id &&
        a.escala_id === escala.id &&
        limparDigitos(a.consulente_telefone ?? '') === telLimpo
    );
    if (existente) {
      return {
        atendimento_id: existente.id,
        gira_id: gira.id,
        escala_id: escala.id,
        numero_senha: existente.numero_senha,
        status: existente.status,
        consulente_nome: existente.consulente_nome,
        consulente_telefone: existente.consulente_telefone,
        primeira_vez: existente.primeira_vez,
        origem: existente.origem,
        gira_titulo: gira.titulo,
        data_gira: gira.data_gira,
        nome_entidade: entidade?.nome_entidade ?? 'Entidade',
        linha: entidade?.linha ?? null,
        medium_nome: medium?.nome ?? 'Médium',
        criado_em: existente.criado_em,
        ja_existia: true,
      };
    }
  }

  if (!escala.ativo) {
    throw new Error('ESCALA_PAUSADA');
  }

  const atdsEscala = db.atendimentos.filter((a) => a.escala_id === escala.id);
  if (atdsEscala.length >= escala.limite_senhas) {
    throw new Error('ESGOTADO');
  }

  const maxNumero = atdsEscala.reduce((max, item) => Math.max(max, item.numero_senha), 0);
  const novo: Atendimento = {
    id: gerarUuidLocal(),
    gira_id: gira.id,
    escala_id: escala.id,
    numero_senha: maxNumero + 1,
    consulente_nome: params.nome.trim(),
    consulente_telefone: params.telefone?.trim() || null,
    primeira_vez: params.primeiraVez,
    status: 'AGUARDANDO',
    origem,
    criado_em: new Date().toISOString(),
    chamado_em: null,
    hora_atendimento: null,
  };

  db.atendimentos.push(novo);
  salvarLocalDb(db);

  return {
    atendimento_id: novo.id,
    gira_id: gira.id,
    escala_id: escala.id,
    numero_senha: novo.numero_senha,
    status: novo.status,
    consulente_nome: novo.consulente_nome,
    consulente_telefone: novo.consulente_telefone,
    primeira_vez: novo.primeira_vez,
    origem: novo.origem,
    gira_titulo: gira.titulo,
    data_gira: gira.data_gira,
    nome_entidade: entidade?.nome_entidade ?? 'Entidade',
    linha: entidade?.linha ?? null,
    medium_nome: medium?.nome ?? 'Médium',
    criado_em: novo.criado_em,
    ja_existia: false,
  };
}

export async function getAtendimentoStatusEPosicao(atendimentoId: string): Promise<{
  status: StatusAtendimento;
  pessoasNaFrente: number;
} | null> {
  if (isSupabaseConfigured && supabase) {
    const { data: atual, error } = await supabase
      .from('atendimentos')
      .select('id, escala_id, numero_senha, status')
      .eq('id', atendimentoId)
      .maybeSingle();

    if (error || !atual) return null;

    let pessoasNaFrente = 0;
    if (atual.status === 'AGUARDANDO') {
      const { count } = await supabase
        .from('atendimentos')
        .select('id', { count: 'exact', head: true })
        .eq('escala_id', atual.escala_id)
        .eq('status', 'AGUARDANDO')
        .lt('numero_senha', atual.numero_senha);
      pessoasNaFrente = count ?? 0;
    }

    return {
      status: atual.status as StatusAtendimento,
      pessoasNaFrente,
    };
  }

  const db = lerLocalDb();
  const atual = db.atendimentos.find((a) => a.id === atendimentoId);
  if (!atual) return null;

  const pessoasNaFrente =
    atual.status === 'AGUARDANDO'
      ? db.atendimentos.filter(
          (a) =>
            a.escala_id === atual.escala_id &&
            a.status === 'AGUARDANDO' &&
            a.numero_senha < atual.numero_senha
        ).length
      : 0;

  return {
    status: atual.status,
    pessoasNaFrente,
  };
}

export function subscribeAtendimento(
  atendimentoId: string,
  escalaId: string,
  onAtualizacao: (novoStatus?: StatusAtendimento) => void
): () => void {
  if (isSupabaseConfigured && supabase) {
    const client = supabase;
    const channel = client
      .channel(`atendimento-${atendimentoId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'atendimentos',
          filter: `escala_id=eq.${escalaId}`,
        },
        (payload) => {
          const record = payload.new as Partial<Atendimento> | undefined;
          if (record?.id === atendimentoId && record.status) {
            onAtualizacao(record.status);
          } else {
            onAtualizacao();
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }

  return subscribeLocalRealtime(() => {
    const db = lerLocalDb();
    const row = db.atendimentos.find((a) => a.id === atendimentoId);
    onAtualizacao(row?.status);
  });
}

// ============================================================================
// FASE 3: PAINEL DO CAMBONO / RECEPÇÃO
// ============================================================================

export async function getAtendimentosGiraAberta(): Promise<Atendimento[]> {
  if (isSupabaseConfigured && supabase) {
    const { data: giraAberta, error: giraErr } = await supabase
      .from('giras')
      .select('id')
      .eq('status', 'ABERTA')
      .maybeSingle();

    if (giraErr) throw giraErr;
    if (!giraAberta) return [];

    const { data, error } = await supabase
      .from('atendimentos')
      .select('*')
      .eq('gira_id', giraAberta.id)
      .order('numero_senha', { ascending: true });

    if (error) throw error;
    return (data ?? []) as Atendimento[];
  }

  const db = lerLocalDb();
  const giraAberta = db.giras.find((g) => g.status === 'ABERTA');
  if (!giraAberta) return [];
  return db.atendimentos
    .filter((a) => a.gira_id === giraAberta.id)
    .sort((a, b) => a.numero_senha - b.numero_senha);
}

export async function chamarConsulente(atendimentoId: string): Promise<void> {
  const agora = new Date().toISOString();
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('atendimentos')
      .update({
        status: 'EM_ATENDIMENTO',
        chamado_em: agora,
      })
      .eq('id', atendimentoId);

    if (error) throw error;
    return;
  }

  const db = lerLocalDb();
  const idx = db.atendimentos.findIndex((a) => a.id === atendimentoId);
  if (idx >= 0) {
    db.atendimentos[idx] = {
      ...db.atendimentos[idx],
      status: 'EM_ATENDIMENTO',
      chamado_em: agora,
    };
    salvarLocalDb(db);
  }
}

export async function finalizarAtendimento(atendimentoId: string): Promise<void> {
  const agora = new Date().toISOString();
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('atendimentos')
      .update({
        status: 'ATENDIDO',
        hora_atendimento: agora,
      })
      .eq('id', atendimentoId);

    if (error) throw error;
    return;
  }

  const db = lerLocalDb();
  const idx = db.atendimentos.findIndex((a) => a.id === atendimentoId);
  if (idx >= 0) {
    db.atendimentos[idx] = {
      ...db.atendimentos[idx],
      status: 'ATENDIDO',
      hora_atendimento: agora,
    };
    salvarLocalDb(db);
  }
}

export async function marcarAusenteAtendimento(
  atendimentoId: string,
  liberarVaga: boolean
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc('marcar_ausente_atendimento', {
      p_atendimento_id: atendimentoId,
      p_liberar_vaga: liberarVaga,
    });
    if (error) throw error;
    return;
  }

  const db = lerLocalDb();
  const idx = db.atendimentos.findIndex((a) => a.id === atendimentoId);
  if (idx >= 0) {
    const escalaId = db.atendimentos[idx].escala_id;
    db.atendimentos[idx] = {
      ...db.atendimentos[idx],
      status: 'AUSENTE',
    };
    if (liberarVaga) {
      const escIdx = db.gira_escalas.findIndex((e) => e.id === escalaId);
      if (escIdx >= 0) {
        db.gira_escalas[escIdx] = {
          ...db.gira_escalas[escIdx],
          limite_senhas: db.gira_escalas[escIdx].limite_senhas + 1,
        };
      }
    }
    salvarLocalDb(db);
  }
}

export async function restaurarParaFila(atendimentoId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('atendimentos')
      .update({
        status: 'AGUARDANDO',
      })
      .eq('id', atendimentoId);
    if (error) throw error;
    return;
  }

  const db = lerLocalDb();
  const idx = db.atendimentos.findIndex((a) => a.id === atendimentoId);
  if (idx >= 0) {
    db.atendimentos[idx] = {
      ...db.atendimentos[idx],
      status: 'AGUARDANDO',
    };
    salvarLocalDb(db);
  }
}

export function subscribeFilaGira(onChange: () => void): () => void {
  if (isSupabaseConfigured && supabase) {
    const client = supabase;
    const channel = client
      .channel(`fila-gira-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atendimentos' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gira_escalas' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'giras' }, onChange)
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }

  return subscribeLocalRealtime(onChange);
}

// ============================================================================
// FASE 4: ÁREA ADMINISTRATIVA (GIRA, CADASTROS E RELATÓRIOS)
// ============================================================================

export async function getGiraAberta(): Promise<Gira | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('giras')
      .select('*')
      .eq('status', 'ABERTA')
      .maybeSingle();

    if (error) throw error;
    return (data as Gira | null) ?? null;
  }

  const db = lerLocalDb();
  return db.giras.find((g) => g.status === 'ABERTA') ?? null;
}

export async function abrirNovaGira(params: {
  titulo: string;
  dataGira: string;
  escalas: EscalaNovaInput[];
}): Promise<Gira> {
  if (params.escalas.length === 0) {
    throw new Error('Adicione ao menos uma entidade na escala da gira.');
  }

  if (isSupabaseConfigured && supabase) {
    const { data: giraCriada, error: giraErr } = await supabase
      .from('giras')
      .insert({
        titulo: params.titulo.trim(),
        data_gira: params.dataGira,
        status: 'ABERTA',
      })
      .select('*')
      .single();

    if (giraErr) throw giraErr;

    const linhasEscala = params.escalas.map((e) => ({
      gira_id: giraCriada.id,
      entidade_id: e.entidade_id,
      medium_id: e.medium_id,
      cambono_id: e.cambono_id || null,
      limite_senhas: Math.max(0, e.limite_senhas),
      ativo: true,
    }));

    const { error: escErr } = await supabase.from('gira_escalas').insert(linhasEscala);
    if (escErr) throw escErr;

    return giraCriada as Gira;
  }

  const db = lerLocalDb();
  if (db.giras.some((g) => g.status === 'ABERTA')) {
    throw new Error('idx_unica_gira_aberta');
  }

  const agora = new Date().toISOString();
  const novaGira: Gira = {
    id: gerarUuidLocal(),
    titulo: params.titulo.trim(),
    data_gira: params.dataGira,
    status: 'ABERTA',
    aberta_em: agora,
    encerrada_em: null,
  };

  db.giras.push(novaGira);
  params.escalas.forEach((e) => {
    db.gira_escalas.push({
      id: gerarUuidLocal(),
      gira_id: novaGira.id,
      entidade_id: e.entidade_id,
      medium_id: e.medium_id,
      cambono_id: e.cambono_id || null,
      limite_senhas: Math.max(0, e.limite_senhas),
      ativo: true,
      criado_em: agora,
    });
  });

  salvarLocalDb(db);
  return novaGira;
}

export async function adicionarEscalaNaGira(
  giraId: string,
  escala: EscalaNovaInput
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('gira_escalas').insert({
      gira_id: giraId,
      entidade_id: escala.entidade_id,
      medium_id: escala.medium_id,
      cambono_id: escala.cambono_id || null,
      limite_senhas: Math.max(0, escala.limite_senhas),
      ativo: true,
    });
    if (error) throw error;
    return;
  }

  const db = lerLocalDb();
  db.gira_escalas.push({
    id: gerarUuidLocal(),
    gira_id: giraId,
    entidade_id: escala.entidade_id,
    medium_id: escala.medium_id,
    cambono_id: escala.cambono_id || null,
    limite_senhas: Math.max(0, escala.limite_senhas),
    ativo: true,
    criado_em: new Date().toISOString(),
  });
  salvarLocalDb(db);
}

export async function ajustarLimiteEscala(escalaId: string, novoLimite: number): Promise<void> {
  const limiteSeguro = Math.max(0, Math.floor(novoLimite));
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('gira_escalas')
      .update({ limite_senhas: limiteSeguro })
      .eq('id', escalaId);
    if (error) throw error;
    return;
  }

  const db = lerLocalDb();
  const idx = db.gira_escalas.findIndex((e) => e.id === escalaId);
  if (idx >= 0) {
    db.gira_escalas[idx] = { ...db.gira_escalas[idx], limite_senhas: limiteSeguro };
    salvarLocalDb(db);
  }
}

export async function alternarStatusEscala(escalaId: string, ativo: boolean): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('gira_escalas')
      .update({ ativo })
      .eq('id', escalaId);
    if (error) throw error;
    return;
  }

  const db = lerLocalDb();
  const idx = db.gira_escalas.findIndex((e) => e.id === escalaId);
  if (idx >= 0) {
    db.gira_escalas[idx] = { ...db.gira_escalas[idx], ativo };
    salvarLocalDb(db);
  }
}

export async function excluirEscalaDaGira(escalaId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('gira_escalas').delete().eq('id', escalaId);
    if (error) throw error;
    return;
  }

  const db = lerLocalDb();
  db.gira_escalas = db.gira_escalas.filter((e) => e.id !== escalaId);
  db.atendimentos = db.atendimentos.filter((a) => a.escala_id !== escalaId);
  salvarLocalDb(db);
}

export async function encerrarGira(giraId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.rpc('encerrar_gira', { p_gira_id: giraId });
    if (error) throw error;
    return;
  }

  const db = lerLocalDb();
  const agora = new Date().toISOString();
  db.atendimentos = db.atendimentos.map((a) =>
    a.gira_id === giraId && a.status === 'AGUARDANDO'
      ? { ...a, status: 'NAO_ATENDIDO' }
      : a
  );
  db.giras = db.giras.map((g) =>
    g.id === giraId ? { ...g, status: 'ENCERRADA', encerrada_em: agora } : g
  );
  salvarLocalDb(db);
}

// --- Cadastros Base ---

export async function listarEntidades(): Promise<Entidade[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('entidades')
      .select('*')
      .order('nome_entidade', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Entidade[];
  }

  return [...lerLocalDb().entidades].sort((a, b) =>
    a.nome_entidade.localeCompare(b.nome_entidade)
  );
}

export async function criarEntidade(nome_entidade: string, linha: string): Promise<Entidade> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('entidades')
      .insert({
        nome_entidade: nome_entidade.trim(),
        linha: linha.trim() || null,
        ativo: true,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as Entidade;
  }

  const db = lerLocalDb();
  const nova: Entidade = {
    id: gerarUuidLocal(),
    nome_entidade: nome_entidade.trim(),
    linha: linha.trim() || null,
    ativo: true,
    criado_em: new Date().toISOString(),
  };
  db.entidades.push(nova);
  salvarLocalDb(db);
  return nova;
}

export async function alternarEntidadeAtiva(id: string, ativo: boolean): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('entidades').update({ ativo }).eq('id', id);
    if (error) throw error;
    return;
  }

  const db = lerLocalDb();
  db.entidades = db.entidades.map((e) => (e.id === id ? { ...e, ativo } : e));
  salvarLocalDb(db);
}

export async function listarEquipeEspiritual(): Promise<EquipeEspiritual[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('equipe_espiritual')
      .select('*')
      .order('nome', { ascending: true });
    if (error) throw error;
    return (data ?? []) as EquipeEspiritual[];
  }

  return [...lerLocalDb().equipe_espiritual].sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function criarMembroEquipe(nome: string, tipo: TipoMembro): Promise<EquipeEspiritual> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('equipe_espiritual')
      .insert({
        nome: nome.trim(),
        tipo,
        ativo: true,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data as EquipeEspiritual;
  }

  const db = lerLocalDb();
  const novo: EquipeEspiritual = {
    id: gerarUuidLocal(),
    nome: nome.trim(),
    tipo,
    ativo: true,
    criado_em: new Date().toISOString(),
  };
  db.equipe_espiritual.push(novo);
  salvarLocalDb(db);
  return novo;
}

export async function alternarMembroAtivo(id: string, ativo: boolean): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('equipe_espiritual')
      .update({ ativo })
      .eq('id', id);
    if (error) throw error;
    return;
  }

  const db = lerLocalDb();
  db.equipe_espiritual = db.equipe_espiritual.map((m) =>
    m.id === id ? { ...m, ativo } : m
  );
  salvarLocalDb(db);
}

// --- Relatórios Gerenciais ---

export async function consultarRelatorioAtendimentos(
  filtros: FiltroRelatorio
): Promise<AtendimentoDetalhado[]> {
  let giras: Gira[] = [];
  let escalas: GiraEscala[] = [];
  let entidades: Entidade[] = [];
  let equipe: EquipeEspiritual[] = [];
  let atendimentos: Atendimento[] = [];

  if (isSupabaseConfigured && supabase) {
    const [gRes, geRes, eRes, eqRes, aRes] = await Promise.all([
      supabase.from('giras').select('*'),
      supabase.from('gira_escalas').select('*'),
      supabase.from('entidades').select('*'),
      supabase.from('equipe_espiritual').select('*'),
      supabase
        .from('atendimentos')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(3000),
    ]);

    if (gRes.error) throw gRes.error;
    if (geRes.error) throw geRes.error;
    if (eRes.error) throw eRes.error;
    if (eqRes.error) throw eqRes.error;
    if (aRes.error) throw aRes.error;

    giras = (gRes.data ?? []) as Gira[];
    escalas = (geRes.data ?? []) as GiraEscala[];
    entidades = (eRes.data ?? []) as Entidade[];
    equipe = (eqRes.data ?? []) as EquipeEspiritual[];
    atendimentos = (aRes.data ?? []) as Atendimento[];
  } else {
    const db = lerLocalDb();
    giras = db.giras;
    escalas = db.gira_escalas;
    entidades = db.entidades;
    equipe = db.equipe_espiritual;
    atendimentos = [...db.atendimentos].sort((a, b) =>
      b.criado_em.localeCompare(a.criado_em)
    );
  }

  const giraMap = new Map(giras.map((g) => [g.id, g]));
  const escalaMap = new Map(escalas.map((ge) => [ge.id, ge]));
  const entMap = new Map(entidades.map((e) => [e.id, e]));
  const eqMap = new Map(equipe.map((m) => [m.id, m]));

  const detalhados: AtendimentoDetalhado[] = atendimentos.map((a) => {
    const gira = giraMap.get(a.gira_id);
    const escala = escalaMap.get(a.escala_id);
    const entidade = escala ? entMap.get(escala.entidade_id) : undefined;
    const medium = escala ? eqMap.get(escala.medium_id) : undefined;
    const cambono = escala?.cambono_id ? eqMap.get(escala.cambono_id) : undefined;

    return {
      ...a,
      gira_titulo: gira?.titulo ?? 'Gira',
      data_gira: gira?.data_gira ?? a.criado_em.slice(0, 10),
      entidade_id: escala?.entidade_id ?? '',
      nome_entidade: entidade?.nome_entidade ?? 'Entidade',
      linha: entidade?.linha ?? null,
      medium_id: escala?.medium_id ?? '',
      medium_nome: medium?.nome ?? 'Médium',
      cambono_nome: cambono?.nome ?? null,
    };
  });

  const termo = (filtros.busca ?? '').trim().toLowerCase();
  const termoDigitos = limparDigitos(termo);

  return detalhados.filter((item) => {
    if (filtros.data_inicial && item.data_gira < filtros.data_inicial) return false;
    if (filtros.data_final && item.data_gira > filtros.data_final) return false;
    if (filtros.entidade_id && item.entidade_id !== filtros.entidade_id) return false;
    if (filtros.medium_id && item.medium_id !== filtros.medium_id) return false;
    if (filtros.status && item.status !== filtros.status) return false;
    if (termo) {
      const bateNome = item.consulente_nome.toLowerCase().includes(termo);
      const bateTel =
        item.consulente_telefone?.toLowerCase().includes(termo) ||
        (termoDigitos.length > 0 &&
          limparDigitos(item.consulente_telefone ?? '').includes(termoDigitos));
      if (!bateNome && !bateTel) return false;
    }
    return true;
  });
}

export function getLocalSeedProfiles(): PerfilAcesso[] {
  return lerLocalDb().perfis_acesso;
}

