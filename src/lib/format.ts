import type { StatusAtendimento } from '../types/database';

export const TERREIRO_NOME = 'Àṣẹ Àlákétú Ilé Iforití';
export const TERREIRO_SUBTITULO = 'Tenda Espírita Caboclo 7 Flechas';
export const LOGO_TERREIRO_URL = `${import.meta.env.BASE_URL}logo.png`;

export function limparDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function formatarTelefone(valor: string): string {
  const digitos = limparDigitos(valor).slice(0, 11);
  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export function formatarSenha(numero: number): string {
  return `#${String(numero).padStart(2, '0')}`;
}

export function formatarDataBR(dataIso: string): string {
  if (!dataIso) return '-';
  const apenasData = dataIso.slice(0, 10);
  const parts = apenasData.split('-');
  if (parts.length !== 3) return dataIso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatarHoraBR(iso?: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function hojeISO(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export const STATUS_ATENDIMENTO_LABEL: Record<StatusAtendimento, string> = {
  AGUARDANDO: 'Aguardando Chamada',
  EM_ATENDIMENTO: 'Em Atendimento',
  ATENDIDO: 'Atendido',
  AUSENTE: 'Ausente',
  NAO_ATENDIDO: 'Não Atendido',
};

export function extrairMensagemErro(error: unknown, fallback = 'Erro ao processar operação.'): string {
  if (!error) return fallback;
  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof (error as { message?: unknown }).message === 'string'
          ? (error as { message: string }).message
          : fallback;

  if (raw.includes('ESGOTADO')) return 'As senhas para esta entidade já esgotaram.';
  if (raw.includes('ESCALA_PAUSADA')) return 'As senhas para esta entidade estão temporariamente pausadas.';
  if (raw.includes('GIRA_ENCERRADA')) return 'Não há gira aberta no momento.';
  if (raw.includes('NOME_OBRIGATORIO')) return 'Informe o nome completo do consulente.';
  if (raw.includes('idx_unica_gira_aberta')) return 'Já existe uma gira aberta. Encerre-a antes de abrir outra.';
  if (raw.includes('Invalid login credentials')) return 'E-mail ou senha inválidos.';
  return raw;
}

export { desbloquearAudio, falarChamadaVoz, tocarSinoChamada } from './sound';
export { tocarSinoChamada as notificarChamadaNoDispositivo } from './sound';

export function gerarMensagemWhatsAppChamada(params: {
  consulenteNome: string;
  numeroSenha: number;
  nomeEntidade: string;
  mediumNome?: string | null;
}): string {
  const nomeLimpo = params.consulenteNome.replace(/\s*\|\|\s*.*$/, '').trim();
  const partes = [
    `*${TERREIRO_NOME}*`,
    `Olá, *${nomeLimpo}*! Axé! 🌿`,
    '',
    `🔔 Sua senha *${formatarSenha(params.numeroSenha)}* está sendo chamada agora para atendimento com *${params.nomeEntidade}*${
      params.mediumNome ? ` (Médium: ${params.mediumNome})` : ''
    }.`,
    '',
    'Por favor, dirija-se à sala de atendimento.',
  ];
  return partes.join('\n');
}

export function gerarMensagemWhatsAppOrientacoes(params: {
  consulenteNome: string;
  numeroSenha: number;
  nomeEntidade?: string | null;
  mediumNome?: string | null;
  dataGira?: string | null;
  giraTitulo?: string | null;
  orientacoes?: string | null;
}): string {
  const nomeLimpo = params.consulenteNome.replace(/\s*\|\|\s*.*$/, '').trim();
  const linhas = [
    `*${TERREIRO_NOME}*`,
    `Olá, *${nomeLimpo}*! Axé! 🌿`,
    '',
    `Seguem as informações do seu atendimento (${formatarSenha(params.numeroSenha)}):`,
    params.giraTitulo
      ? `📅 Gira: ${params.giraTitulo}${params.dataGira ? ` (${formatarDataBR(params.dataGira)})` : ''}`
      : params.dataGira
      ? `📅 Data: ${formatarDataBR(params.dataGira)}`
      : '',
    params.nomeEntidade
      ? `✨ Entidade: ${params.nomeEntidade}${params.mediumNome ? ` (Médium: ${params.mediumNome})` : ''}`
      : '',
  ];

  if (params.orientacoes && params.orientacoes.trim()) {
    linhas.push('', `*Orientações:*\n${params.orientacoes.trim()}`);
  }

  return linhas.filter(Boolean).join('\n');
}

