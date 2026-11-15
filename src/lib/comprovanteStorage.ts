import type { ComprovanteSenha, StatusAtendimento } from '../types/database';

const STORAGE_LIST_KEY = 'iforiti_comprovantes_v2';
const STORAGE_ACTIVE_ID_KEY = 'iforiti_comprovante_ativo_id_v2';

export function listarComprovantesLocais(giraId?: string): ComprovanteSenha[] {
  try {
    const raw = localStorage.getItem(STORAGE_LIST_KEY);
    if (!raw) return [];
    const lista = JSON.parse(raw) as ComprovanteSenha[];
    if (!Array.isArray(lista)) return [];
    return giraId ? lista.filter((item) => item.gira_id === giraId) : lista;
  } catch {
    return [];
  }
}

export function salvarComprovanteLocal(comprovante: ComprovanteSenha): void {
  try {
    // Limite estrito de 1 senha ativa por aparelho
    localStorage.setItem(STORAGE_LIST_KEY, JSON.stringify([comprovante]));
    localStorage.setItem(STORAGE_ACTIVE_ID_KEY, comprovante.atendimento_id);
  } catch {
    // Ignore quota errors
  }
}

export function definirComprovanteAtivoId(atendimentoId: string): void {
  try {
    localStorage.setItem(STORAGE_ACTIVE_ID_KEY, atendimentoId);
  } catch {
    // Ignore
  }
}

export function obterComprovanteAtivoLocal(giraId?: string): ComprovanteSenha | null {
  try {
    const lista = listarComprovantesLocais(giraId);
    if (lista.length === 0) return null;
    const ativoId = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);
    if (ativoId) {
      const encontrado = lista.find((c) => c.atendimento_id === ativoId);
      if (encontrado) return encontrado;
    }
    return lista[0];
  } catch {
    return null;
  }
}

export function atualizarStatusComprovanteLocal(
  atendimentoId: string,
  status: StatusAtendimento
): void {
  try {
    const atuais = listarComprovantesLocais();
    const atualizados = atuais.map((item) =>
      item.atendimento_id === atendimentoId ? { ...item, status } : item
    );
    localStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(atualizados));
  } catch {
    // Ignore
  }
}

export function atualizarEntidadeComprovanteLocal(
  atendimentoId: string,
  dados: {
    escala_id: string;
    numero_senha: number;
    nome_entidade: string;
    medium_nome?: string;
    linha?: string | null;
  }
): void {
  try {
    const atuais = listarComprovantesLocais();
    const atualizados = atuais.map((item) =>
      item.atendimento_id === atendimentoId
        ? {
            ...item,
            escala_id: dados.escala_id,
            numero_senha: dados.numero_senha,
            nome_entidade: dados.nome_entidade,
            medium_nome: dados.medium_nome ?? item.medium_nome,
            linha: dados.linha !== undefined ? dados.linha : item.linha,
            status: 'AGUARDANDO' as StatusAtendimento,
          }
        : item
    );
    localStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(atualizados));
  } catch {
    // Ignore
  }
}

export function limparComprovantesLocais(): void {
  try {
    localStorage.removeItem(STORAGE_LIST_KEY);
    localStorage.removeItem(STORAGE_ACTIVE_ID_KEY);
  } catch {
    // Ignore
  }
}

export function limparComprovantesExcetoGira(giraAbertaId: string | null): void {
  if (!giraAbertaId) {
    limparComprovantesLocais();
    return;
  }
  const ativos = listarComprovantesLocais(giraAbertaId);
  if (ativos.length === 0) {
    limparComprovantesLocais();
    return;
  }
  salvarComprovanteLocal(ativos[0]);
}
