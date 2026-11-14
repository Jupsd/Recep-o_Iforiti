export type PerfilUsuario = 'ADMIN' | 'CAMBONO';
export type TipoMembro = 'MEDIUM' | 'CAMBONO';
export type StatusGira = 'ABERTA' | 'ENCERRADA';
export type StatusAtendimento =
  | 'AGUARDANDO'
  | 'EM_ATENDIMENTO'
  | 'ATENDIDO'
  | 'AUSENTE'
  | 'NAO_ATENDIDO';
export type OrigemCheckin = 'QRCODE' | 'MANUAL';

export interface PerfilAcesso {
  id: string;
  nome: string;
  email?: string | null;
  perfil: PerfilUsuario;
  ativo: boolean;
  criado_em: string;
}

export interface EquipeEspiritual {
  id: string;
  nome: string;
  tipo: TipoMembro;
  ativo: boolean;
  criado_em: string;
}

export interface Entidade {
  id: string;
  nome_entidade: string;
  linha: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface Gira {
  id: string;
  titulo: string;
  data_gira: string;
  status: StatusGira;
  aberta_em: string;
  encerrada_em: string | null;
}

export interface GiraEscala {
  id: string;
  gira_id: string;
  entidade_id: string;
  medium_id: string;
  cambono_id: string | null;
  limite_senhas: number;
  ativo: boolean;
  criado_em: string;
}

export interface Atendimento {
  id: string;
  gira_id: string;
  escala_id: string;
  numero_senha: number;
  consulente_nome: string;
  consulente_telefone: string | null;
  primeira_vez: boolean;
  status: StatusAtendimento;
  origem: OrigemCheckin;
  criado_em: string;
  chamado_em: string | null;
  hora_atendimento: string | null;
}

export interface DisponibilidadeGira {
  escala_id: string;
  gira_id: string;
  gira_titulo: string;
  data_gira: string;
  gira_status: StatusGira;
  entidade_id: string;
  nome_entidade: string;
  linha: string | null;
  medium_id: string;
  medium_nome: string;
  cambono_id: string | null;
  cambono_nome: string | null;
  limite_senhas: number;
  escala_ativa: boolean;
  senhas_geradas: number;
  atendidos: number;
  na_fila: number;
  em_atendimento: number;
  ausentes: number;
  vagas_restantes: number;
}

export interface ComprovanteSenha {
  atendimento_id: string;
  gira_id: string;
  escala_id: string;
  numero_senha: number;
  status: StatusAtendimento;
  consulente_nome: string;
  consulente_telefone: string | null;
  primeira_vez: boolean;
  origem: OrigemCheckin;
  gira_titulo: string;
  data_gira: string;
  nome_entidade: string;
  linha: string | null;
  medium_nome: string;
  criado_em: string;
  ja_existia?: boolean;
}

export interface AtendimentoDetalhado extends Atendimento {
  gira_titulo: string;
  data_gira: string;
  entidade_id: string;
  nome_entidade: string;
  linha: string | null;
  medium_id: string;
  medium_nome: string;
  cambono_nome: string | null;
}

export interface EscalaNovaInput {
  entidade_id: string;
  medium_id: string;
  cambono_id: string | null;
  limite_senhas: number;
}

export interface FiltroRelatorio {
  data_inicial?: string;
  data_final?: string;
  entidade_id?: string;
  medium_id?: string;
  status?: StatusAtendimento | '';
  busca?: string;
}

