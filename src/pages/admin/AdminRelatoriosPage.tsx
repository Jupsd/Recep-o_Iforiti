import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Filter,
  Loader2,
  Search,
  Star,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import {
  extrairMensagemErro,
  formatarDataBR,
  formatarHoraBR,
  formatarSenha,
  hojeISO,
  STATUS_ATENDIMENTO_LABEL,
} from '../../lib/format';
import {
  consultarRelatorioAtendimentos,
  listarEntidades,
  listarEquipeEspiritual,
} from '../../services/dataService';
import type {
  AtendimentoDetalhado,
  Entidade,
  EquipeEspiritual,
  StatusAtendimento,
} from '../../types/database';

export function AdminRelatoriosPage() {
  const [registros, setRegistros] = useState<AtendimentoDetalhado[]>([]);
  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [mediuns, setMediuns] = useState<EquipeEspiritual[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [entidadeId, setEntidadeId] = useState('');
  const [mediumId, setMediumId] = useState('');
  const [status, setStatus] = useState<StatusAtendimento | ''>('');
  const [busca, setBusca] = useState('');

  const buscarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [dados, ents, eq] = await Promise.all([
        consultarRelatorioAtendimentos({
          data_inicial: dataInicial || undefined,
          data_final: dataFinal || undefined,
          entidade_id: entidadeId || undefined,
          medium_id: mediumId || undefined,
          status,
          busca: busca || undefined,
        }),
        listarEntidades(),
        listarEquipeEspiritual(),
      ]);
      setRegistros(dados);
      setEntidades(ents);
      setMediuns(eq.filter((m) => m.tipo === 'MEDIUM'));
    } catch (err) {
      setErro(extrairMensagemErro(err, 'Erro ao carregar relatórios.'));
    } finally {
      setCarregando(false);
    }
  }, [dataInicial, dataFinal, entidadeId, mediumId, status, busca]);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  const resumo = useMemo(() => {
    const total = registros.length;
    const atendidos = registros.filter((r) => r.status === 'ATENDIDO').length;
    const ausentesOuNao = registros.filter(
      (r) => r.status === 'AUSENTE' || r.status === 'NAO_ATENDIDO'
    ).length;
    const primeiraVez = registros.filter((r) => r.primeira_vez).length;
    return { total, atendidos, ausentesOuNao, primeiraVez };
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
      <div className="space-y-6">
        {/* Filtros */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-terreiro-700" />
              <h2 className="text-lg font-extrabold text-slate-900">
                Relatórios Gerenciais
              </h2>
            </div>

            <button
              type="button"
              disabled={registros.length === 0}
              onClick={exportarExcel}
              className="min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold text-sm inline-flex items-center gap-2 transition shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel (.xlsx)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusAtendimento | '')}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-300 bg-white text-sm"
              >
                <option value="">Todos</option>
                <option value="ATENDIDO">Atendido</option>
                <option value="AGUARDANDO">Aguardando</option>
                <option value="EM_ATENDIMENTO">Em Atendimento</option>
                <option value="AUSENTE">Ausente</option>
                <option value="NAO_ATENDIDO">Não Atendido</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Consulente / Telefone
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome ou telefone"
                  className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>
          </div>
        </section>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm font-semibold">
            {erro}
          </div>
        )}

        {/* Cards Totalizadores */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-slate-500">Total de Senhas</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{resumo.total}</p>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-emerald-700">Total Atendidos</p>
            <p className="text-3xl font-black text-emerald-700 mt-1">{resumo.atendidos}</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-amber-700">
              Ausentes / Não Atendidos
            </p>
            <p className="text-3xl font-black text-amber-700 mt-1">
              {resumo.ausentesOuNao}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-sky-200 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase text-sky-700">
              Visitantes 1ª Vez
            </p>
            <p className="text-3xl font-black text-sky-700 mt-1">{resumo.primeiraVez}</p>
          </div>
        </section>

        {/* Tabela Detalhada */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {carregando ? (
            <div className="py-12 flex items-center justify-center gap-2 text-slate-600 text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-terreiro-700" />
              <span>Consultando atendimentos...</span>
            </div>
          ) : registros.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              Nenhum atendimento encontrado para os filtros selecionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-600">
                    <th className="py-3 px-4 font-bold">Data</th>
                    <th className="py-3 px-4 font-bold">Senha</th>
                    <th className="py-3 px-4 font-bold">Consulente</th>
                    <th className="py-3 px-4 font-bold">Entidade / Médium</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold">Horário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registros.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        <span className="font-medium text-slate-900 block">
                          {formatarDataBR(r.data_gira)}
                        </span>
                        <span className="text-xs text-slate-500">{r.gira_titulo}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-black text-terreiro-800">
                        {formatarSenha(r.numero_senha)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">
                            {r.consulente_nome}
                          </span>
                          {r.primeira_vez && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                              1ª Vez <Star className="w-2.5 h-2.5 fill-amber-600" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">
                          {r.consulente_telefone || 'Sem telefone'} ({r.origem})
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">
                          {r.nome_entidade}
                        </span>
                        <span className="text-xs text-slate-500">{r.medium_nome}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
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
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                        <div>Check-in: {formatarHoraBR(r.criado_em)}</div>
                        {r.hora_atendimento && (
                          <div>Fim: {formatarHoraBR(r.hora_atendimento)}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}

