import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Calendar,
  Eraser,
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  MessageCircle,
  Search,
  Sparkles,
  Star,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { FichaConsulenteModal } from '../../components/FichaConsulenteModal';
import {
  extrairMensagemErro,
  formatarDataBR,
  formatarHoraBR,
  formatarSenha,
  gerarMensagemWhatsAppOrientacoes,
  hojeISO,
  limparDigitos,
  STATUS_ATENDIMENTO_LABEL,
} from '../../lib/format';
import { exportarRelatorioAtendimentosPDF } from '../../lib/pdfExport';
import {
  consultarRelatorioAtendimentos,
  excluirAtendimento,
  excluirGira,
  listarEntidades,
  listarEquipeEspiritual,
  listarGiras,
} from '../../services/dataService';
import type {
  AtendimentoDetalhado,
  Entidade,
  EquipeEspiritual,
  Gira,
  StatusAtendimento,
} from '../../types/database';

type AbaNavegacao = 'ATENDIMENTOS' | 'CONSULENTES' | 'RESUMO_EQUIPE';

interface GrupoConsulente {
  chave: string;
  nome: string;
  telefone: string | null;
  ultimaData: string;
  totalVisitas: number;
  totalAtendidos: number;
  entidades: string[];
  cambonos: string[];
  atendimentos: AtendimentoDetalhado[];
  ultimoAtendimento: AtendimentoDetalhado;
}

interface GrupoEstatistica {
  id: string;
  nome: string;
  subtitulo?: string | null;
  total: number;
  atendidos: number;
  comOrientacoes: number;
}

export function AdminRelatoriosPage() {
  const [registros, setRegistros] = useState<AtendimentoDetalhado[]>([]);
  const [giras, setGiras] = useState<Gira[]>([]);
  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [mediuns, setMediuns] = useState<EquipeEspiritual[]>([]);
  const [cambonos, setCambonos] = useState<EquipeEspiritual[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [abaAtiva, setAbaAtiva] = useState<AbaNavegacao>('ATENDIMENTOS');
  const [mostrarFiltrosAvancados, setMostrarFiltrosAvancados] = useState(true);
  const [atendimentoFicha, setAtendimentoFicha] = useState<AtendimentoDetalhado | null>(null);

  // Filtros de pesquisa prática e rápida
  const [busca, setBusca] = useState('');
  const [giraId, setGiraId] = useState('');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [entidadeId, setEntidadeId] = useState('');
  const [cambonoId, setCambonoId] = useState('');
  const [mediumId, setMediumId] = useState('');
  const [status, setStatus] = useState<StatusAtendimento | ''>('');

  // Chips rápidos
  const [apenasAtendidos, setApenasAtendidos] = useState(false);
  const [apenasComOrientacoes, setApenasComOrientacoes] = useState(false);
  const [apenasPrimeiraVez, setApenasPrimeiraVez] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const buscarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [dados, listaGiras, ents, eq] = await Promise.all([
        consultarRelatorioAtendimentos({
          gira_id: giraId || undefined,
          data_inicial: dataInicial || undefined,
          data_final: dataFinal || undefined,
          entidade_id: entidadeId || undefined,
          cambono_id: cambonoId || undefined,
          medium_id: mediumId || undefined,
          status,
          busca: busca || undefined,
          apenas_atendidos: apenasAtendidos,
          apenas_com_orientacoes: apenasComOrientacoes,
          apenas_primeira_vez: apenasPrimeiraVez,
        }),
        listarGiras(),
        listarEntidades(),
        listarEquipeEspiritual(),
      ]);
      setRegistros(dados);
      setGiras(listaGiras);
      setEntidades(ents);
      setMediuns(eq.filter((m) => m.tipo === 'MEDIUM'));
      setCambonos(eq.filter((m) => m.tipo === 'CAMBONO'));
    } catch (err) {
      setErro(extrairMensagemErro(err, 'Erro ao carregar busca e relatórios.'));
    } finally {
      setCarregando(false);
    }
  }, [
    giraId,
    dataInicial,
    dataFinal,
    entidadeId,
    cambonoId,
    mediumId,
    status,
    busca,
    apenasAtendidos,
    apenasComOrientacoes,
    apenasPrimeiraVez,
  ]);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  function limparFiltros() {
    setBusca('');
    setGiraId('');
    setDataInicial('');
    setDataFinal('');
    setEntidadeId('');
    setCambonoId('');
    setMediumId('');
    setStatus('');
    setApenasAtendidos(false);
    setApenasComOrientacoes(false);
    setApenasPrimeiraVez(false);
  }

  async function handleExcluirAtendimento(atendimento: AtendimentoDetalhado) {
    if (
      !window.confirm(
        `Deseja excluir permanentemente o atendimento de "${atendimento.consulente_nome}" (Senha ${formatarSenha(atendimento.numero_senha)}) da gira "${atendimento.gira_titulo}"?\n\nEsta ação apagará a ficha e o registro do histórico.`
      )
    ) {
      return;
    }
    setExcluindoId(atendimento.id);
    setErro(null);
    try {
      await excluirAtendimento(atendimento.id);
      await buscarDados();
    } catch (err) {
      setErro(extrairMensagemErro(err, 'Erro ao excluir atendimento.'));
    } finally {
      setExcluindoId(null);
    }
  }

  async function handleExcluirGiraSelecionada() {
    if (!giraId) return;
    const alvo = giras.find((g) => g.id === giraId);
    const titulo = alvo ? `${alvo.titulo} (${formatarDataBR(alvo.data_gira)})` : 'esta gira';
    if (
      !window.confirm(
        `Tem certeza que deseja excluir permanentemente a gira "${titulo}"?\n\nEsta ação apagará a gira e quaisquer atendimentos vinculados a ela.`
      )
    ) {
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      await excluirGira(giraId);
      setGiraId('');
      await buscarDados();
    } catch (err) {
      setErro(extrairMensagemErro(err, 'Erro ao excluir gira.'));
      setCarregando(false);
    }
  }

  const possuiFiltroAtivo = Boolean(
    busca ||
      giraId ||
      dataInicial ||
      dataFinal ||
      entidadeId ||
      cambonoId ||
      mediumId ||
      status ||
      apenasAtendidos ||
      apenasComOrientacoes ||
      apenasPrimeiraVez
  );

  const resumo = useMemo(() => {
    const total = registros.length;
    const atendidos = registros.filter((r) => r.status === 'ATENDIDO').length;
    const comOrientacoes = registros.filter((r) => Boolean(r.orientacoes?.trim())).length;
    const primeiraVez = registros.filter((r) => r.primeira_vez).length;
    return { total, atendidos, comOrientacoes, primeiraVez };
  }, [registros]);

  // Agrupamento rápido por Consulente (Ficha / Prontuário de Clientes)
  const gruposConsulentes = useMemo<GrupoConsulente[]>(() => {
    const grupos: GrupoConsulente[] = [];
    const telMap = new Map<string, GrupoConsulente>();
    const nomeMap = new Map<string, GrupoConsulente>();

    for (const r of registros) {
      const telDig = limparDigitos(r.consulente_telefone ?? '');
      const nomeNorm = r.consulente_nome.trim().toLowerCase();

      let grupo =
        (telDig.length >= 8 ? telMap.get(telDig) : undefined) ||
        nomeMap.get(nomeNorm);

      if (!grupo) {
        grupo = {
          chave: telDig.length >= 8 ? `tel:${telDig}` : `nome:${nomeNorm}:${r.id}`,
          nome: r.consulente_nome,
          telefone: r.consulente_telefone,
          ultimaData: r.data_gira,
          totalVisitas: 0,
          totalAtendidos: 0,
          entidades: [],
          cambonos: [],
          atendimentos: [],
          ultimoAtendimento: r,
        };
        grupos.push(grupo);
      }

      if (telDig.length >= 8) telMap.set(telDig, grupo);
      if (nomeNorm) nomeMap.set(nomeNorm, grupo);

      grupo.totalVisitas += 1;
      if (r.status === 'ATENDIDO') grupo.totalAtendidos += 1;
      if (!grupo.telefone && r.consulente_telefone) {
        grupo.telefone = r.consulente_telefone;
      }
      if (!grupo.entidades.includes(r.nome_entidade)) {
        grupo.entidades.push(r.nome_entidade);
      }
      if (r.cambono_nome && !grupo.cambonos.includes(r.cambono_nome)) {
        grupo.cambonos.push(r.cambono_nome);
      }
      grupo.atendimentos.push(r);
    }

    return grupos;
  }, [registros]);

  // Estatísticas clicáveis por Entidade, Cambono e Médium
  const resumoPorEntidade = useMemo<GrupoEstatistica[]>(() => {
    const mapa = new Map<string, GrupoEstatistica>();
    for (const r of registros) {
      const id = r.entidade_id || r.nome_entidade;
      const atual = mapa.get(id) ?? {
        id: r.entidade_id,
        nome: r.nome_entidade,
        subtitulo: r.linha,
        total: 0,
        atendidos: 0,
        comOrientacoes: 0,
      };
      atual.total += 1;
      if (r.status === 'ATENDIDO') atual.atendidos += 1;
      if (r.orientacoes?.trim()) atual.comOrientacoes += 1;
      mapa.set(id, atual);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [registros]);

  const resumoPorCambono = useMemo<GrupoEstatistica[]>(() => {
    const mapa = new Map<string, GrupoEstatistica>();
    for (const r of registros) {
      if (!r.cambono_id || !r.cambono_nome) continue;
      const atual = mapa.get(r.cambono_id) ?? {
        id: r.cambono_id,
        nome: r.cambono_nome,
        total: 0,
        atendidos: 0,
        comOrientacoes: 0,
      };
      atual.total += 1;
      if (r.status === 'ATENDIDO') atual.atendidos += 1;
      if (r.orientacoes?.trim()) atual.comOrientacoes += 1;
      mapa.set(r.cambono_id, atual);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [registros]);

  const resumoPorMedium = useMemo<GrupoEstatistica[]>(() => {
    const mapa = new Map<string, GrupoEstatistica>();
    for (const r of registros) {
      const id = r.medium_id || r.medium_nome;
      const atual = mapa.get(id) ?? {
        id: r.medium_id,
        nome: r.medium_nome,
        total: 0,
        atendidos: 0,
        comOrientacoes: 0,
      };
      atual.total += 1;
      if (r.status === 'ATENDIDO') atual.atendidos += 1;
      if (r.orientacoes?.trim()) atual.comOrientacoes += 1;
      mapa.set(id, atual);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [registros]);

  function exportarExcel() {
    if (registros.length === 0) return;

    const linhasPlanilha = registros.map((r) => ({
      Data: formatarDataBR(r.data_gira),
      Gira: r.gira_titulo,
      Senha: formatarSenha(r.numero_senha),
      Consulente: r.consulente_nome,
      Telefone: r.consulente_telefone ?? '',
      'Primeira Vez': r.primeira_vez ? 'Sim' : 'Não',
      Entidade: r.nome_entidade,
      Médium: r.medium_nome,
      Cambono: r.cambono_nome ?? '',
      Status: STATUS_ATENDIMENTO_LABEL[r.status],
      Orientações: r.orientacoes ?? '',
      Origem: r.origem,
      'Hora Check-in': formatarHoraBR(r.criado_em),
      'Hora Atendimento': formatarHoraBR(r.hora_atendimento),
    }));

    const worksheet = XLSX.utils.json_to_sheet(linhasPlanilha);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Atendimentos');
    XLSX.writeFile(workbook, `relatorio-atendimentos-${hojeISO()}.xlsx`);
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Barra de Pesquisa Rápida e Filtros */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-terreiro-700" />
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Central de Busca, Histórico e Relatórios
                </h2>
                <p className="text-xs text-slate-500">
                  Pesquise atendimentos antigos, clientes atendidos, orientações, entidades, cambonos e médiuns.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMostrarFiltrosAvancados((v) => !v)}
                className="min-h-[42px] px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs inline-flex items-center gap-1.5 transition"
              >
                <Filter className="w-4 h-4" />
                <span>{mostrarFiltrosAvancados ? 'Ocultar Filtros' : 'Mais Filtros'}</span>
              </button>

              <button
                type="button"
                disabled={registros.length === 0}
                onClick={() => exportarRelatorioAtendimentosPDF(registros, resumo)}
                className="min-h-[42px] px-4 rounded-xl bg-red-700 hover:bg-red-800 disabled:bg-slate-300 text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition shadow-sm"
              >
                <FileDown className="w-4 h-4" />
                <span>Exportar PDF</span>
              </button>

              <button
                type="button"
                disabled={registros.length === 0}
                onClick={exportarExcel}
                className="min-h-[42px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold text-xs sm:text-sm inline-flex items-center gap-2 transition shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Busca Instantânea Unificada */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Busca rápida: digite nome do consulente, telefone, orientação, entidade, cambono, médium ou gira..."
              className="w-full min-h-[48px] pl-11 pr-24 rounded-2xl border-2 border-slate-300 focus:border-terreiro-600 focus:outline-none text-sm font-medium text-slate-900 bg-slate-50 focus:bg-white transition"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-3 top-2.5 px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Chips Rápidos */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setApenasAtendidos(false);
                setApenasComOrientacoes(false);
                setApenasPrimeiraVez(false);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                !apenasAtendidos && !apenasComOrientacoes && !apenasPrimeiraVez
                  ? 'bg-terreiro-700 border-terreiro-700 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Todos
            </button>

            <button
              type="button"
              onClick={() => setApenasAtendidos((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition inline-flex items-center gap-1 ${
                apenasAtendidos
                  ? 'bg-emerald-700 border-emerald-700 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-emerald-50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Apenas Atendidos</span>
            </button>

            <button
              type="button"
              onClick={() => setApenasComOrientacoes((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition inline-flex items-center gap-1 ${
                apenasComOrientacoes
                  ? 'bg-sky-700 border-sky-700 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-sky-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Com Orientações</span>
            </button>

            <button
              type="button"
              onClick={() => setApenasPrimeiraVez((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition inline-flex items-center gap-1 ${
                apenasPrimeiraVez
                  ? 'bg-amber-600 border-amber-600 text-white'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-amber-50'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>1ª Vez</span>
            </button>

            {possuiFiltroAtivo && (
              <button
                type="button"
                onClick={limparFiltros}
                className="ml-auto px-3 py-1.5 rounded-full text-xs font-bold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 inline-flex items-center gap-1"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            )}
          </div>

          {/* Filtros Detalhados */}
          {mostrarFiltrosAvancados && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Gira (Antigas e Atual)
                </label>
                <select
                  value={giraId}
                  onChange={(e) => setGiraId(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="">Todas as Giras</option>
                  {giras.map((g) => {
                    const hora = g.aberta_em ? ` às ${formatarHoraBR(g.aberta_em)}` : '';
                    return (
                      <option key={g.id} value={g.id}>
                        {formatarDataBR(g.data_gira)}{hora} — {g.titulo} ({g.status})
                      </option>
                    );
                  })}
                </select>
                {giraId && (
                  <button
                    type="button"
                    onClick={handleExcluirGiraSelecionada}
                    className="mt-1 text-[11px] text-red-600 hover:text-red-800 font-bold inline-flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Excluir gira selecionada</span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Entidade
                </label>
                <select
                  value={entidadeId}
                  onChange={(e) => setEntidadeId(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="">Todas</option>
                  {entidades.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome_entidade}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Cambono
                </label>
                <select
                  value={cambonoId}
                  onChange={(e) => setCambonoId(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="">Todos</option>
                  {cambonos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Médium
                </label>
                <select
                  value={mediumId}
                  onChange={(e) => setMediumId(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="">Todos</option>
                  {mediuns.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={dataInicial}
                  onChange={(e) => setDataInicial(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Data Final
                </label>
                <input
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Status do Atendimento
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusAtendimento | '')}
                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="">Todos os Status</option>
                  <option value="ATENDIDO">Atendido</option>
                  <option value="AGUARDANDO">Aguardando</option>
                  <option value="EM_ATENDIMENTO">Em Atendimento</option>
                  <option value="AUSENTE">Ausente</option>
                  <option value="NAO_ATENDIDO">Não Atendido</option>
                </select>
              </div>
            </div>
          )}
        </section>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm font-semibold">
            {erro}
          </div>
        )}

        {/* Cards Totalizadores */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Registros Encontrados</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{resumo.total}</p>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-emerald-700">Atendidos</p>
            <p className="text-3xl font-black text-emerald-700 mt-1">{resumo.atendidos}</p>
          </div>
          <div className="bg-white rounded-2xl border border-sky-200 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-sky-700">Com Orientações</p>
            <p className="text-3xl font-black text-sky-700 mt-1">{resumo.comOrientacoes}</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-amber-700">Visitantes 1ª Vez</p>
            <p className="text-3xl font-black text-amber-700 mt-1">{resumo.primeiraVez}</p>
          </div>
        </section>

        {/* Abas de Navegação Prática e Rápida */}
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border border-slate-200 p-2 shadow-sm">
          <button
            type="button"
            onClick={() => setAbaAtiva('ATENDIMENTOS')}
            className={`flex-1 min-w-[180px] min-h-[44px] px-4 rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-2 transition ${
              abaAtiva === 'ATENDIMENTOS'
                ? 'bg-terreiro-700 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Atendimentos & Histórico ({registros.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('CONSULENTES')}
            className={`flex-1 min-w-[180px] min-h-[44px] px-4 rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-2 transition ${
              abaAtiva === 'CONSULENTES'
                ? 'bg-terreiro-700 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Consulentes / Clientes ({gruposConsulentes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('RESUMO_EQUIPE')}
            className={`flex-1 min-w-[180px] min-h-[44px] px-4 rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-2 transition ${
              abaAtiva === 'RESUMO_EQUIPE'
                ? 'bg-terreiro-700 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Por Entidades, Cambonos e Médiuns</span>
          </button>
        </div>

        {/* Conteúdo da Aba Selecionada */}
        {carregando ? (
          <div className="bg-white rounded-3xl border border-slate-200 py-14 flex items-center justify-center gap-2 text-slate-600 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-terreiro-700" />
            <span>Consultando atendimentos e fichas...</span>
          </div>
        ) : registros.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-2">
            <p className="text-base font-bold text-slate-800">
              Nenhum atendimento encontrado para os filtros aplicados.
            </p>
            {possuiFiltroAtivo && (
              <button
                type="button"
                onClick={limparFiltros}
                className="mt-2 px-4 py-2 rounded-xl bg-terreiro-700 text-white text-xs font-bold"
              >
                Mostrar Todos os Registros
              </button>
            )}
          </div>
        ) : abaAtiva === 'ATENDIMENTOS' ? (
          <section className="space-y-3">
            {registros.map((r) => {
              const digitosTel = limparDigitos(r.consulente_telefone ?? '');
              return (
                <article
                  key={r.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="px-3 py-1.5 rounded-xl bg-terreiro-100 text-terreiro-900 font-black text-base shrink-0">
                        {formatarSenha(r.numero_senha)}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-extrabold text-slate-900">
                            {r.consulente_nome}
                          </h3>
                          {r.primeira_vez && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                              1ª Vez <Star className="w-3 h-3 fill-amber-600" />
                            </span>
                          )}
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              r.status === 'ATENDIDO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'EM_ATENDIMENTO'
                                  ? 'bg-sky-100 text-sky-800'
                                  : r.status === 'AUSENTE'
                                    ? 'bg-amber-100 text-amber-800'
                                    : r.status === 'NAO_ATENDIDO'
                                      ? 'bg-slate-200 text-slate-700'
                                      : 'bg-indigo-50 text-indigo-800'
                            }`}
                          >
                            {STATUS_ATENDIMENTO_LABEL[r.status]}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 mt-1">
                          <strong>{formatarDataBR(r.data_gira)}</strong> • {r.gira_titulo} • Check-in:{' '}
                          {formatarHoraBR(r.criado_em)}
                          {r.hora_atendimento ? ` • Atendido: ${formatarHoraBR(r.hora_atendimento)}` : ''}
                        </p>

                        <p className="text-xs text-slate-700 mt-1">
                          Entidade: <strong>{r.nome_entidade}</strong> • Médium:{' '}
                          <strong>{r.medium_nome}</strong>
                          {r.cambono_nome ? (
                            <>
                              {' '}
                              • Cambono: <strong>{r.cambono_nome}</strong>
                            </>
                          ) : null}
                          {r.consulente_telefone ? ` • Tel: ${r.consulente_telefone}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAtendimentoFicha(r)}
                        className="min-h-[38px] px-3.5 rounded-xl bg-terreiro-50 hover:bg-terreiro-100 border border-terreiro-200 text-terreiro-800 text-xs font-extrabold inline-flex items-center gap-1.5 transition"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Ficha / Orientações</span>
                      </button>

                      {digitosTel.length >= 10 && (
                        <a
                          href={`https://wa.me/55${digitosTel}?text=${encodeURIComponent(
                            gerarMensagemWhatsAppOrientacoes({
                              consulenteNome: r.consulente_nome,
                              numeroSenha: r.numero_senha,
                              nomeEntidade: r.nome_entidade,
                              mediumNome: r.medium_nome,
                              dataGira: r.data_gira,
                              giraTitulo: r.gira_titulo,
                              orientacoes: r.orientacoes,
                            })
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[38px] px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold inline-flex items-center gap-1 transition"
                          title="Enviar dados do atendimento no WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleExcluirAtendimento(r)}
                        disabled={excluindoId === r.id}
                        title="Excluir Ficha / Atendimento"
                        className="min-h-[38px] px-3 rounded-xl bg-red-50 hover:bg-red-600 hover:text-white border border-red-200 text-red-700 text-xs font-bold inline-flex items-center gap-1 transition"
                      >
                        {excluindoId === r.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>

                  {r.orientacoes ? (
                    <div className="bg-terreiro-50/70 border border-terreiro-200 rounded-xl p-3 text-xs sm:text-sm text-slate-800 whitespace-pre-line">
                      <span className="font-extrabold text-terreiro-900 uppercase text-[11px] block mb-0.5">
                        Orientações / Cadastro do Cliente:
                      </span>
                      {r.orientacoes}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        ) : abaAtiva === 'CONSULENTES' ? (
          <section className="space-y-3">
            {gruposConsulentes.map((g) => {
              const comNotas = g.atendimentos.filter((a) => Boolean(a.orientacoes?.trim()));
              return (
                <article
                  key={g.chave}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold text-slate-900">{g.nome}</h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-terreiro-100 text-terreiro-900 text-xs font-extrabold">
                          {g.totalVisitas} {g.totalVisitas === 1 ? 'visita' : 'visitas'} (
                          {g.totalAtendidos} atend.)
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        {g.telefone || 'Sem telefone'} • Última visita:{' '}
                        <strong>{formatarDataBR(g.ultimaData)}</strong>
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Entidades: <strong>{g.entidades.join(', ')}</strong>
                        {g.cambonos.length > 0 ? ` • Cambonos: ${g.cambonos.join(', ')}` : ''}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAtendimentoFicha(g.ultimoAtendimento)}
                      className="min-h-[40px] px-4 rounded-xl bg-terreiro-700 hover:bg-terreiro-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Abrir Ficha / Incluir Orientações</span>
                    </button>
                  </div>

                  {comNotas.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      <p className="text-[11px] font-extrabold uppercase text-terreiro-800">
                        Orientações Registradas ({comNotas.length}):
                      </p>
                      {comNotas.map((nota) => (
                        <div
                          key={nota.id}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                        >
                          <div className="space-y-1">
                            <p className="font-bold text-slate-900">
                              {formatarDataBR(nota.data_gira)} • {nota.nome_entidade} (
                              {nota.medium_nome}
                              {nota.cambono_nome ? ` • Cambono: ${nota.cambono_nome}` : ''})
                            </p>
                            <p className="text-slate-700 whitespace-pre-line">{nota.orientacoes}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAtendimentoFicha(nota)}
                            className="shrink-0 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700"
                          >
                            Editar
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Nenhuma orientação registrada ainda para este consulente.
                    </p>
                  )}
                </article>
              );
            })}
          </section>
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Por Entidades */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Por Entidade ({resumoPorEntidade.length})
              </h3>
              <p className="text-xs text-slate-500">
                Toque em uma entidade para filtrar e abrir seus atendimentos.
              </p>
              <div className="space-y-2">
                {resumoPorEntidade.map((item) => (
                  <button
                    key={item.id || item.nome}
                    type="button"
                    onClick={() => {
                      if (item.id) setEntidadeId(item.id);
                      setAbaAtiva('ATENDIMENTOS');
                    }}
                    className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-terreiro-500 hover:bg-terreiro-50/50 transition space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{item.nome}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-terreiro-100 text-terreiro-900 text-xs font-black">
                        {item.total}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Atendidos: <strong>{item.atendidos}</strong> • Com orientações:{' '}
                      <strong>{item.comOrientacoes}</strong>
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Por Cambonos */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Por Cambono ({resumoPorCambono.length})
              </h3>
              <p className="text-xs text-slate-500">
                Toque em um cambono para visualizar todos os atendimentos acompanhados.
              </p>
              {resumoPorCambono.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  Nenhum cambono vinculado às escalas filtradas no momento.
                </p>
              ) : (
                <div className="space-y-2">
                  {resumoPorCambono.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCambonoId(item.id);
                        setAbaAtiva('ATENDIMENTOS');
                      }}
                      className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 transition space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-sm text-slate-900">{item.nome}</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-900 text-xs font-black">
                          {item.total}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Atendidos: <strong>{item.atendidos}</strong> • Com orientações:{' '}
                        <strong>{item.comOrientacoes}</strong>
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Por Médiuns */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Por Médium ({resumoPorMedium.length})
              </h3>
              <p className="text-xs text-slate-500">
                Toque em um médium para ver seu histórico de atendimentos.
              </p>
              <div className="space-y-2">
                {resumoPorMedium.map((item) => (
                  <button
                    key={item.id || item.nome}
                    type="button"
                    onClick={() => {
                      if (item.id) setMediumId(item.id);
                      setAbaAtiva('ATENDIMENTOS');
                    }}
                    className="w-full text-left p-3.5 rounded-2xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/40 transition space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-sm text-slate-900">{item.nome}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 text-xs font-black">
                        {item.total}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Atendidos: <strong>{item.atendidos}</strong> • Com orientações:{' '}
                      <strong>{item.comOrientacoes}</strong>
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Modal Ficha / Orientações no Admin */}
      {atendimentoFicha && (
        <FichaConsulenteModal
          atendimento={atendimentoFicha}
          nomeEntidade={atendimentoFicha.nome_entidade}
          mediumNome={atendimentoFicha.medium_nome}
          cambonoNome={atendimentoFicha.cambono_nome}
          giraTitulo={atendimentoFicha.gira_titulo}
          dataGira={atendimentoFicha.data_gira}
          onClose={() => setAtendimentoFicha(null)}
          onSalvo={buscarDados}
        />
      )}
    </AdminLayout>
  );
}
