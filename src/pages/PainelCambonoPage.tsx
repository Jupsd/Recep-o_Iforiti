import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  CalendarCog,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  LogOut,
  MessageCircle,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Star,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { FichaConsulenteModal } from '../components/FichaConsulenteModal';
import { useAuth } from '../contexts/AuthContext';
import {
  desbloquearAudio,
  extrairMensagemErro,
  falarChamadaVoz,
  formatarDataBR,
  formatarHoraBR,
  formatarSenha,
  formatarTelefone,
  gerarMensagemWhatsAppChamada,
  gerarMensagemWhatsAppOrientacoes,
  limparDigitos,
  LOGO_TERREIRO_URL,
  TERREIRO_NOME,
  TERREIRO_SUBTITULO,
} from '../lib/format';
import {
  ajustarLimiteEscala,
  alternarStatusEscala,
  chamarConsulente,
  finalizarAtendimento,
  gerarSenhaConsulente,
  getAtendimentosGiraAberta,
  getDisponibilidadeGiraAberta,
  marcarAusenteAtendimento,
  restaurarParaFila,
  salvarFichaConsulente,
  subscribeFilaGira,
} from '../services/dataService';
import type { Atendimento, DisponibilidadeGira } from '../types/database';

const MODELOS_ORIENTACAO_RAPIDA = [
  {
    rotulo: '+ Banho de Ervas',
    texto: 'Banho de ervas recomendado: ',
  },
  {
    rotulo: '+ Vela de 7 Dias',
    texto: 'Acender vela de 7 dias com firmeza/oração: ',
  },
  {
    rotulo: '+ Oferenda / Elemento',
    texto: 'Entrega / oferenda orientada: ',
  },
  {
    rotulo: '+ Retorno na próxima gira',
    texto: 'Orientado(a) a retornar na próxima gira de atendimento.',
  },
  {
    rotulo: '+ Corrente de Oração',
    texto: 'Incluir nome nas orações / firmezas da casa.',
  },
];

export function PainelCambonoPage() {
  const { perfil, signOut, isModoLocal } = useAuth();
  const navigate = useNavigate();

  const [escalas, setEscalas] = useState<DisponibilidadeGira[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [escalaAtivaId, setEscalaAtivaId] = useState<string>('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [vozAtiva, setVozAtiva] = useState(false);

  const [abaPainel, setAbaPainel] = useState<'FILA' | 'FICHAS'>('FILA');
  const [historicoAberto, setHistoricoAberto] = useState(true);
  const [acaoEmAndamentoId, setAcaoEmAndamentoId] = useState<string | null>(null);
  const [buscaFila, setBuscaFila] = useState('');
  const [atendimentoFicha, setAtendimentoFicha] = useState<Atendimento | null>(null);
  const [rascunhoOrientacoes, setRascunhoOrientacoes] = useState<Record<string, string>>({});
  const [salvandoOrientacaoId, setSalvandoOrientacaoId] = useState<string | null>(null);
  const [feedbackOrientacao, setFeedbackOrientacao] = useState<string | null>(null);

  // Modal Ausência (RF10)
  const [atendimentoAusencia, setAtendimentoAusencia] = useState<Atendimento | null>(null);

  // Modal + Manual (RN02)
  const [modalManualAberto, setModalManualAberto] = useState(false);
  const [manualNome, setManualNome] = useState('');
  const [manualTelefone, setManualTelefone] = useState('');
  const [manualPrimeiraVez, setManualPrimeiraVez] = useState(false);
  const [manualEscalaId, setManualEscalaId] = useState('');
  const [manualOrientacoes, setManualOrientacoes] = useState('');
  const [salvandoManual, setSalvandoManual] = useState(false);
  const [erroManual, setErroManual] = useState<string | null>(null);
  const [feedbackManual, setFeedbackManual] = useState<string | null>(null);

  // Modal Limite Rápido
  const [modalLimiteAberto, setModalLimiteAberto] = useState(false);
  const [novoLimiteInput, setNovoLimiteInput] = useState<number>(0);

  const carregarDados = useCallback(async () => {
    try {
      setErro(null);
      const [disp, atds] = await Promise.all([
        getDisponibilidadeGiraAberta(),
        getAtendimentosGiraAberta(),
      ]);
      setEscalas(disp);
      setAtendimentos(atds);

      if (disp.length > 0) {
        setEscalaAtivaId((atual) =>
          disp.some((d) => d.escala_id === atual) ? atual : disp[0].escala_id
        );
      } else {
        setEscalaAtivaId('');
      }
    } catch (err) {
      setErro(extrairMensagemErro(err, 'Erro ao carregar fila de atendimento.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
    const unsub = subscribeFilaGira(() => {
      carregarDados();
    });
    const onVis = () => {
      if (document.visibilityState === 'visible') carregarDados();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [carregarDados]);

  const escalaSelecionada = useMemo(
    () => escalas.find((e) => e.escala_id === escalaAtivaId) ?? null,
    [escalas, escalaAtivaId]
  );

  const atendimentosEscala = useMemo(
    () => atendimentos.filter((a) => a.escala_id === escalaAtivaId),
    [atendimentos, escalaAtivaId]
  );

  const filtrarPorBusca = useCallback(
    (lista: Atendimento[]) => {
      const termo = buscaFila.trim().toLowerCase();
      if (!termo) return lista;
      const digitos = limparDigitos(termo);
      return lista.filter((a) => {
        const senhaFmt = formatarSenha(a.numero_senha).toLowerCase();
        return (
          a.consulente_nome.toLowerCase().includes(termo) ||
          (a.orientacoes ?? '').toLowerCase().includes(termo) ||
          senhaFmt.includes(termo) ||
          String(a.numero_senha) === termo ||
          (a.consulente_telefone ?? '').toLowerCase().includes(termo) ||
          (digitos.length >= 2 && limparDigitos(a.consulente_telefone ?? '').includes(digitos))
        );
      });
    },
    [buscaFila]
  );

  const emAtendimento = useMemo(
    () => filtrarPorBusca(atendimentosEscala.filter((a) => a.status === 'EM_ATENDIMENTO')),
    [atendimentosEscala, filtrarPorBusca]
  );

  const aguardandoTotal = useMemo(
    () => atendimentosEscala.filter((a) => a.status === 'AGUARDANDO'),
    [atendimentosEscala]
  );

  const aguardando = useMemo(
    () =>
      filtrarPorBusca(aguardandoTotal).sort((a, b) => a.numero_senha - b.numero_senha),
    [aguardandoTotal, filtrarPorBusca]
  );

  const finalizadosTotal = useMemo(
    () =>
      atendimentosEscala.filter(
        (a) => a.status === 'ATENDIDO' || a.status === 'AUSENTE' || a.status === 'NAO_ATENDIDO'
      ),
    [atendimentosEscala]
  );

  const finalizados = useMemo(
    () => filtrarPorBusca(finalizadosTotal).sort((a, b) => b.numero_senha - a.numero_senha),
    [finalizadosTotal, filtrarPorBusca]
  );

  const totalAtendidos = finalizadosTotal.filter((a) => a.status === 'ATENDIDO').length;
  const totalAusentes = finalizadosTotal.filter((a) => a.status === 'AUSENTE').length;

  const fichasOrdenadas = useMemo(() => {
    const pesoStatus: Record<string, number> = {
      EM_ATENDIMENTO: 0,
      AGUARDANDO: 1,
      ATENDIDO: 2,
      AUSENTE: 3,
      NAO_ATENDIDO: 4,
    };
    return filtrarPorBusca(atendimentosEscala).sort((a, b) => {
      const diff = (pesoStatus[a.status] ?? 9) - (pesoStatus[b.status] ?? 9);
      return diff !== 0 ? diff : a.numero_senha - b.numero_senha;
    });
  }, [atendimentosEscala, filtrarPorBusca]);

  function obterTextoOrientacao(item: Atendimento): string {
    return rascunhoOrientacoes[item.id] ?? item.orientacoes ?? '';
  }

  function atualizarTextoOrientacao(atendimentoId: string, texto: string) {
    setRascunhoOrientacoes((prev) => ({
      ...prev,
      [atendimentoId]: texto,
    }));
  }

  function inserirModeloRapido(item: Atendimento, modelo: string) {
    const base = obterTextoOrientacao(item).trim();
    atualizarTextoOrientacao(item.id, base ? `${base}\n• ${modelo}` : `• ${modelo}`);
  }

  async function handleSalvarOrientacaoInline(
    item: Atendimento,
    finalizarDepois = false
  ) {
    setErro(null);
    setSalvandoOrientacaoId(item.id);
    try {
      await salvarFichaConsulente({
        atendimentoId: item.id,
        nome: item.consulente_nome,
        telefone: item.consulente_telefone,
        primeiraVez: item.primeira_vez,
        orientacoes: obterTextoOrientacao(item).trim() || null,
      });

      if (finalizarDepois) {
        await finalizarAtendimento(item.id);
      }

      setRascunhoOrientacoes((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });

      setFeedbackOrientacao(
        finalizarDepois
          ? `Orientações salvas e atendimento de ${item.consulente_nome} finalizado!`
          : `Orientações da consulta de ${item.consulente_nome} salvas na ficha!`
      );
      setTimeout(() => setFeedbackOrientacao(null), 5000);
      await carregarDados();
    } catch (err) {
      setErro(extrairMensagemErro(err, 'Não foi possível salvar as orientações da consulta.'));
    } finally {
      setSalvandoOrientacaoId(null);
    }
  }

  async function handleChamar(item: Atendimento) {
    setAcaoEmAndamentoId(item.id);
    try {
      await chamarConsulente(item.id);
      if (vozAtiva && escalaSelecionada) {
        falarChamadaVoz(item.numero_senha, item.consulente_nome, escalaSelecionada.nome_entidade);
      }
      await carregarDados();
    } catch (err) {
      setErro(extrairMensagemErro(err));
    } finally {
      setAcaoEmAndamentoId(null);
    }
  }

  async function confirmarAusencia(liberarVaga: boolean) {
    if (!atendimentoAusencia) return;
    setAcaoEmAndamentoId(atendimentoAusencia.id);
    try {
      await marcarAusenteAtendimento(atendimentoAusencia.id, liberarVaga);
      setAtendimentoAusencia(null);
      await carregarDados();
    } catch (err) {
      setErro(extrairMensagemErro(err));
    } finally {
      setAcaoEmAndamentoId(null);
    }
  }

  async function handleRestaurar(item: Atendimento) {
    setAcaoEmAndamentoId(item.id);
    try {
      await restaurarParaFila(item.id);
      await carregarDados();
    } catch (err) {
      setErro(extrairMensagemErro(err));
    } finally {
      setAcaoEmAndamentoId(null);
    }
  }

  function abrirModalManual() {
    setManualNome('');
    setManualTelefone('');
    setManualPrimeiraVez(false);
    setManualOrientacoes('');
    setManualEscalaId(escalaAtivaId || escalas[0]?.escala_id || '');
    setErroManual(null);
    setModalManualAberto(true);
  }

  async function handleSalvarManual(e: React.FormEvent) {
    e.preventDefault();
    setErroManual(null);
    if (manualNome.trim().length < 2) {
      setErroManual('Informe o nome do consulente.');
      return;
    }
    if (!manualEscalaId) {
      setErroManual('Selecione uma entidade.');
      return;
    }

    setSalvandoManual(true);
    try {
      const comp = await gerarSenhaConsulente({
        escalaId: manualEscalaId,
        nome: manualNome.trim(),
        telefone: manualTelefone || undefined,
        primeiraVez: manualPrimeiraVez,
        origem: 'MANUAL',
        orientacoes: manualOrientacoes.trim() || undefined,
      });
      setModalManualAberto(false);
      setEscalaAtivaId(manualEscalaId);
      setFeedbackManual(
        `Senha ${formatarSenha(comp.numero_senha)} gerada manualmente para ${comp.consulente_nome} (${comp.nome_entidade}).`
      );
      setTimeout(() => setFeedbackManual(null), 6000);
      await carregarDados();
    } catch (err) {
      setErroManual(extrairMensagemErro(err));
    } finally {
      setSalvandoManual(false);
    }
  }

  function abrirModalLimite() {
    if (!escalaSelecionada) return;
    setNovoLimiteInput(escalaSelecionada.limite_senhas);
    setModalLimiteAberto(true);
  }

  async function salvarLimiteRapido(e: React.FormEvent) {
    e.preventDefault();
    if (!escalaSelecionada) return;
    try {
      await ajustarLimiteEscala(escalaSelecionada.escala_id, novoLimiteInput);
      setModalLimiteAberto(false);
      await carregarDados();
    } catch (err) {
      setErro(extrairMensagemErro(err));
    }
  }

  async function handleSair() {
    await signOut();
    navigate('/login');
  }

  if (carregando) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <Loader2 className="w-10 h-10 text-terreiro-700 animate-spin mb-3" />
        <p className="text-slate-600 font-medium">Carregando painel de atendimento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* Top Bar */}
      <header className="bg-terreiro-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img
              src={LOGO_TERREIRO_URL}
              alt={TERREIRO_NOME}
              className="w-11 h-11 rounded-xl bg-white object-contain p-0.5 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold leading-tight">
                  Painel de Atendimento
                </h1>
                {isModoLocal && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-950">
                    Local
                  </span>
                )}
              </div>
              <p className="text-xs text-terreiro-200">
                {perfil?.nome} ({perfil?.perfil}) • {TERREIRO_SUBTITULO}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                desbloquearAudio();
                setVozAtiva((v) => !v);
              }}
              title={vozAtiva ? 'Desativar chamada por voz' : 'Ativar chamada por voz'}
              className={`min-h-[42px] px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition ${
                vozAtiva
                  ? 'bg-emerald-600 border-emerald-400 text-white'
                  : 'bg-white/10 border-white/20 text-terreiro-100 hover:bg-white/20'
              }`}
            >
              {vozAtiva ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">Voz</span>
            </button>

            {escalas.length > 0 && (
              <button
                type="button"
                onClick={abrirModalManual}
                className="min-h-[42px] px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-extrabold text-sm inline-flex items-center gap-1.5 shadow transition"
              >
                <Plus className="w-4 h-4" />
                <span>Manual</span>
              </button>
            )}

            {perfil?.perfil === 'ADMIN' && (
              <Link
                to="/admin/gira"
                className="min-h-[42px] px-3.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white font-bold text-xs sm:text-sm inline-flex items-center gap-1.5 transition"
              >
                <CalendarCog className="w-4 h-4" />
                <span>Administração</span>
              </Link>
            )}

            <button
              type="button"
              onClick={handleSair}
              title="Sair"
              className="min-h-[42px] px-3 rounded-xl bg-white/10 hover:bg-red-600 border border-white/20 text-white font-bold text-xs sm:text-sm transition inline-flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        {perfil?.perfil === 'ADMIN' && (
          <nav className="bg-white text-slate-700 border-b border-slate-200">
            <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-2 overflow-x-auto">
              <Link
                to="/admin/gira"
                className="inline-flex items-center gap-2 px-3.5 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap text-slate-700 hover:bg-slate-100 transition"
              >
                <CalendarCog className="w-4 h-4" />
                <span>Gestão da Gira &amp; QR Code</span>
              </Link>
              <Link
                to="/admin/cadastros"
                className="inline-flex items-center gap-2 px-3.5 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap text-slate-700 hover:bg-slate-100 transition"
              >
                <Users className="w-4 h-4" />
                <span>Cadastros Base</span>
              </Link>
              <Link
                to="/admin/relatorios"
                className="inline-flex items-center gap-2 px-3.5 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap text-slate-700 hover:bg-slate-100 transition"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Busca, Histórico &amp; Relatórios</span>
              </Link>
              <span className="inline-flex items-center gap-2 px-3.5 min-h-[40px] rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap bg-terreiro-700 text-white shadow-sm">
                <ClipboardList className="w-4 h-4" />
                <span>Fila / Cambono</span>
              </span>
            </div>
          </nav>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-5 space-y-5">
        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 flex items-center gap-2.5 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{erro}</span>
          </div>
        )}

        {feedbackManual && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl p-4 flex items-center justify-between gap-3 text-sm font-bold shadow-sm">
            <span>{feedbackManual}</span>
            <button type="button" onClick={() => setFeedbackManual(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {feedbackOrientacao && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl p-4 flex items-center justify-between gap-3 text-sm font-bold shadow-sm">
            <span>{feedbackOrientacao}</span>
            <button type="button" onClick={() => setFeedbackOrientacao(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {escalas.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-sm">
            <img
              src={LOGO_TERREIRO_URL}
              alt={TERREIRO_NOME}
              className="w-20 h-20 object-contain mx-auto mb-3 rounded-xl"
            />
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Nenhuma gira aberta no momento
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              Os registros de atendimento e chamadas só são liberados após o Administrador abrir a gira do dia.
            </p>
            {perfil?.perfil === 'ADMIN' && (
              <Link
                to="/admin/gira"
                className="inline-flex items-center justify-center px-6 min-h-[48px] rounded-xl bg-terreiro-700 text-white font-bold hover:bg-terreiro-800 transition"
              >
                Abrir Nova Gira no Admin
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Filtro de Entidade + Contadores */}
            <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {escalas[0].gira_titulo} • {formatarDataBR(escalas[0].data_gira)}
                </span>
                {escalaSelecionada && !escalaSelecionada.escala_ativa && (
                  <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    Senhas Pausadas
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="filtro-escala"
                    className="block text-xs font-bold text-slate-600 mb-1"
                  >
                    Entidade / Médium em Atendimento:
                  </label>
                  <select
                    id="filtro-escala"
                    value={escalaAtivaId}
                    onChange={(e) => setEscalaAtivaId(e.target.value)}
                    className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-slate-300 bg-white font-bold text-slate-900 focus:border-terreiro-600 focus:outline-none"
                  >
                    {escalas.map((esc) => (
                      <option key={esc.escala_id} value={esc.escala_id}>
                        {esc.nome_entidade} ({esc.medium_nome}) — Fila: {esc.na_fila}
                      </option>
                    ))}
                  </select>
                </div>

                {escalaSelecionada && (
                  <div className="flex items-center gap-2 pt-2 sm:pt-5">
                    <div className="px-3.5 py-2 rounded-xl bg-terreiro-50 border border-terreiro-200 text-center">
                      <span className="block text-[11px] font-bold uppercase text-terreiro-700">
                        Atendidos
                      </span>
                      <span className="text-base font-black text-terreiro-900">
                        {totalAtendidos} / {escalaSelecionada.limite_senhas}
                      </span>
                    </div>
                    <div className="px-3.5 py-2 rounded-xl bg-sky-50 border border-sky-200 text-center">
                      <span className="block text-[11px] font-bold uppercase text-sky-700">
                        Na fila
                      </span>
                      <span className="text-base font-black text-sky-900">
                        {aguardandoTotal.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={abrirModalLimite}
                      className="min-h-[48px] px-3.5 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm inline-flex items-center gap-1.5 transition"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Limite</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="relative pt-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-4" />
                <input
                  type="text"
                  value={buscaFila}
                  onChange={(e) => setBuscaFila(e.target.value)}
                  placeholder="Buscar consulente rápido (nome, senha, telefone ou orientação)..."
                  className="w-full min-h-[42px] pl-10 pr-20 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:border-terreiro-600 focus:outline-none transition"
                />
                {buscaFila.trim() && (
                  <button
                    type="button"
                    onClick={() => setBuscaFila('')}
                    className="absolute right-2.5 top-2.5 px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
                  >
                    Limpar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAbaPainel('FILA')}
                  className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition ${
                    abaPainel === 'FILA'
                      ? 'bg-terreiro-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Fila e Chamada ao Vivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAbaPainel('FICHAS')}
                  className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 transition ${
                    abaPainel === 'FICHAS'
                      ? 'bg-terreiro-700 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Fichas e Orientações da Consulta ({atendimentosEscala.length})</span>
                </button>
              </div>
            </section>

            {abaPainel === 'FICHAS' ? (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
                      Fichas e Orientações da Consulta ({fichasOrdenadas.length})
                    </h2>
                    <p className="text-xs text-slate-600">
                      Registre e salve aqui os dados e orientações passadas pela entidade para cada consulente desta escala.
                    </p>
                  </div>
                </div>

                {fichasOrdenadas.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500">
                    Nenhum consulente localizado nesta entidade para o filtro informado.
                  </div>
                ) : (
                  fichasOrdenadas.map((item) => {
                    const digitosTel = limparDigitos(item.consulente_telefone ?? '');
                    const salvandoEste = salvandoOrientacaoId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-2xl border-2 p-4 sm:p-5 shadow-sm space-y-3 ${
                          item.status === 'EM_ATENDIMENTO'
                            ? 'border-emerald-400 bg-emerald-50/40'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`px-3 py-1 rounded-xl font-black text-base ${
                                item.status === 'EM_ATENDIMENTO'
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-terreiro-100 text-terreiro-900'
                              }`}
                            >
                              {formatarSenha(item.numero_senha)}
                            </span>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-extrabold text-slate-900 text-base">
                                  {item.consulente_nome}
                                </p>
                                <span
                                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                    item.status === 'EM_ATENDIMENTO'
                                      ? 'bg-emerald-100 text-emerald-900'
                                      : item.status === 'AGUARDANDO'
                                        ? 'bg-sky-100 text-sky-800'
                                        : item.status === 'ATENDIDO'
                                          ? 'bg-terreiro-100 text-terreiro-800'
                                          : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {item.status === 'EM_ATENDIMENTO'
                                    ? 'Em Atendimento'
                                    : item.status === 'AGUARDANDO'
                                      ? 'Aguardando'
                                      : item.status === 'ATENDIDO'
                                        ? 'Atendido'
                                        : 'Ausente'}
                                </span>
                                {item.primeira_vez && (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">
                                    1ª Vez <Star className="w-3 h-3 fill-amber-600" />
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {item.consulente_telefone || 'Sem telefone informado'} • Check-in:{' '}
                                {formatarHoraBR(item.criado_em)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {digitosTel.length >= 10 && (
                              <a
                                href={`https://wa.me/55${digitosTel}?text=${encodeURIComponent(
                                  item.orientacoes
                                    ? gerarMensagemWhatsAppOrientacoes({
                                        consulenteNome: item.consulente_nome,
                                        numeroSenha: item.numero_senha,
                                        nomeEntidade: escalaSelecionada?.nome_entidade ?? 'Atendimento',
                                        mediumNome: escalaSelecionada?.medium_nome,
                                        dataGira: escalaSelecionada?.data_gira,
                                        giraTitulo: escalaSelecionada?.gira_titulo,
                                        orientacoes: item.orientacoes,
                                      })
                                    : gerarMensagemWhatsAppChamada({
                                        consulenteNome: item.consulente_nome,
                                        numeroSenha: item.numero_senha,
                                        nomeEntidade: escalaSelecionada?.nome_entidade ?? 'Atendimento',
                                        mediumNome: escalaSelecionada?.medium_nome,
                                      })
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100"
                                title="Enviar mensagem no WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => setAtendimentoFicha(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-terreiro-50 hover:bg-terreiro-100 border border-terreiro-200 text-terreiro-800 text-xs font-bold transition"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Ficha Completa / Histórico / PDF</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 pt-1">
                          <div className="flex flex-wrap gap-1.5">
                            {MODELOS_ORIENTACAO_RAPIDA.map((m) => (
                              <button
                                key={m.rotulo}
                                type="button"
                                onClick={() => inserirModeloRapido(item, m.texto)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-terreiro-50 border border-slate-200 hover:border-terreiro-200 text-slate-700 hover:text-terreiro-800 text-xs font-bold transition"
                              >
                                {m.rotulo}
                              </button>
                            ))}
                          </div>

                          <textarea
                            rows={3}
                            value={obterTextoOrientacao(item)}
                            onChange={(e) => atualizarTextoOrientacao(item.id, e.target.value)}
                            placeholder="Escreva aqui as orientações passadas pela entidade (banhos de ervas, velas, firmezas, retornos ou dados da consulta)..."
                            className="w-full p-3 rounded-xl border-2 border-slate-300 bg-white text-sm text-slate-900 focus:border-terreiro-600 focus:outline-none resize-y"
                          />

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={salvandoEste}
                              onClick={() => handleSalvarOrientacaoInline(item, false)}
                              className="min-h-[42px] px-4 rounded-xl bg-terreiro-700 hover:bg-terreiro-800 disabled:bg-slate-300 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition"
                            >
                              {salvandoEste ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              <span>Salvar Orientações</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
            ) : (
              <>
            {/* Bloco A: Em Atendimento Agora */}
            <section className="space-y-2.5">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 px-1">
                Em Atendimento Agora ({emAtendimento.length})
              </h2>

              {emAtendimento.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  {buscaFila.trim()
                    ? 'Nenhum consulente em atendimento corresponde à busca.'
                    : 'Nenhum consulente em atendimento no momento. Chame o próximo da fila abaixo.'}
                </div>
              ) : (
                emAtendimento.map((item) => {
                  const salvandoEste = salvandoOrientacaoId === item.id;
                  return (
                  <div
                    key={item.id}
                    className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="px-3 py-1 rounded-xl bg-emerald-700 text-white font-black text-lg">
                          {formatarSenha(item.numero_senha)}
                        </span>
                        <div>
                          <p className="font-extrabold text-slate-900 text-lg leading-tight">
                            {item.consulente_nome}
                          </p>
                          <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            Início: {formatarHoraBR(item.chamado_em)}
                            {item.primeira_vez && (
                              <span className="ml-2 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-bold">
                                1ª Vez <Star className="w-3 h-3 fill-amber-700" />
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAtendimentoFicha(item)}
                        className="min-h-[40px] px-3.5 rounded-xl bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Ficha Completa / Histórico / PDF</span>
                      </button>
                    </div>

                    <div className="bg-white border border-emerald-200 rounded-2xl p-3.5 space-y-2.5">
                      <label className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase text-emerald-900">
                        <FileText className="w-4 h-4" />
                        <span>Dados da Consulta com a Entidade / Orientações</span>
                      </label>

                      <div className="flex flex-wrap gap-1.5">
                        {MODELOS_ORIENTACAO_RAPIDA.map((m) => (
                          <button
                            key={m.rotulo}
                            type="button"
                            onClick={() => inserirModeloRapido(item, m.texto)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold transition"
                          >
                            {m.rotulo}
                          </button>
                        ))}
                      </div>

                      <textarea
                        rows={3}
                        value={obterTextoOrientacao(item)}
                        onChange={(e) => atualizarTextoOrientacao(item.id, e.target.value)}
                        placeholder="Escreva aqui o que a entidade orientou na consulta (banhos de ervas, velas, firmezas, retornos, observações)..."
                        className="w-full p-3 rounded-xl border-2 border-emerald-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:border-emerald-600 focus:outline-none resize-y"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={salvandoEste || acaoEmAndamentoId === item.id}
                          onClick={() => handleSalvarOrientacaoInline(item, false)}
                          className="min-h-[46px] rounded-xl border-2 border-emerald-600 bg-white hover:bg-emerald-50 disabled:opacity-50 text-emerald-800 font-extrabold text-sm inline-flex items-center justify-center gap-1.5 transition"
                        >
                          {salvandoEste ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          <span>Salvar Orientações</span>
                        </button>

                        <button
                          type="button"
                          disabled={salvandoEste || acaoEmAndamentoId === item.id}
                          onClick={() => handleSalvarOrientacaoInline(item, true)}
                          className="min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-extrabold text-sm inline-flex items-center justify-center gap-1.5 shadow transition"
                        >
                          {salvandoEste || acaoEmAndamentoId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          <span>Salvar e Finalizar Atendimento</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
                })
              )}
            </section>

            {/* Bloco B: Próximos da Fila (AGUARDANDO) */}
            <section className="space-y-2.5">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 px-1">
                Próximos da Fila — Aguardando ({aguardando.length})
              </h2>

              {aguardando.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500">
                  {buscaFila.trim()
                    ? 'Ninguém aguardando corresponde à busca.'
                    : 'Não há ninguém aguardando nesta fila no momento.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {aguardando.map((item) => {
                    const digitosTel = limparDigitos(item.consulente_telefone ?? '');
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            <span className="px-3 py-1.5 rounded-xl bg-terreiro-100 text-terreiro-900 font-black text-base">
                              {formatarSenha(item.numero_senha)}
                            </span>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-bold text-slate-900 text-base">
                                  {item.consulente_nome}
                                </p>
                                {item.primeira_vez && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                    1ª Vez <Star className="w-3 h-3 fill-amber-600" />
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Check-in: {formatarHoraBR(item.criado_em)} (
                                {item.origem === 'MANUAL' ? 'Manual' : 'QR Code'})
                                {item.consulente_telefone ? ` • ${item.consulente_telefone}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAtendimentoFicha(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-terreiro-50 text-terreiro-800 border border-terreiro-200 text-xs font-bold hover:bg-terreiro-100 transition"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Ficha / Orientações</span>
                            </button>

                            {digitosTel.length >= 10 && (
                              <a
                                href={`https://wa.me/55${digitosTel}?text=${encodeURIComponent(
                                  gerarMensagemWhatsAppChamada({
                                    consulenteNome: item.consulente_nome,
                                    numeroSenha: item.numero_senha,
                                    nomeEntidade: escalaSelecionada?.nome_entidade ?? 'Atendimento',
                                    mediumNome: escalaSelecionada?.medium_nome,
                                  })
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100"
                                title="Chamar consulente no WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {item.orientacoes && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 whitespace-pre-line">
                            <span className="font-bold text-slate-900">Orientações: </span>
                            {item.orientacoes}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={acaoEmAndamentoId === item.id}
                            onClick={() => handleChamar(item)}
                            className="min-h-[48px] rounded-xl bg-terreiro-700 hover:bg-terreiro-800 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition"
                          >
                            <Play className="w-4 h-4 fill-white" />
                            <span>Chamar / Iniciar</span>
                          </button>

                          <button
                            type="button"
                            disabled={acaoEmAndamentoId === item.id}
                            onClick={() => setAtendimentoAusencia(item)}
                            className="min-h-[48px] rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-800 font-bold text-sm inline-flex items-center justify-center gap-2 transition"
                          >
                            <X className="w-4 h-4" />
                            <span>Ausente</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Bloco C: Accordion Recolhido (Atendidos / Ausentes) */}
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setHistoricoAberto((v) => !v)}
                className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <span>
                  Ver Já Atendidos ({totalAtendidos}) / Ausentes ({totalAusentes})
                </span>
                {historicoAberto || buscaFila.trim() ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>

              {(historicoAberto || buscaFila.trim().length > 0) && (
                <div className="border-t border-slate-200 divide-y divide-slate-100">
                  {finalizados.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500 text-center">
                      {buscaFila.trim()
                        ? 'Nenhum atendimento finalizado encontrado para esta busca.'
                        : 'Nenhum atendimento concluído ou marcado como ausente ainda.'}
                    </p>
                  ) : (
                    finalizados.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 space-y-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-black text-slate-700 mr-2">
                              {formatarSenha(item.numero_senha)}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {item.consulente_nome}
                            </span>
                            <span
                              className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                                item.status === 'ATENDIDO'
                                  ? 'bg-terreiro-100 text-terreiro-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.status === 'ATENDIDO'
                                ? `Atendido às ${formatarHoraBR(item.hora_atendimento)}`
                                : 'Ausente'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAtendimentoFicha(item)}
                              className="px-3 py-1.5 rounded-lg border border-terreiro-200 bg-terreiro-50 text-xs font-bold text-terreiro-800 hover:bg-terreiro-100 inline-flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Ficha / Orientações</span>
                            </button>

                            <button
                              type="button"
                              disabled={acaoEmAndamentoId === item.id}
                              onClick={() => handleRestaurar(item)}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Voltar p/ Fila</span>
                            </button>
                          </div>
                        </div>

                        {item.orientacoes && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-700 whitespace-pre-line">
                            <span className="font-bold text-slate-900">Orientações: </span>
                            {item.orientacoes}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
              </>
            )}
          </>
        )}
      </main>

      {/* Modal RF10: Ausência */}
      {atendimentoAusencia && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Marcar Consulente Ausente
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  {formatarSenha(atendimentoAusencia.numero_senha)} •{' '}
                  <span className="font-bold">{atendimentoAusencia.consulente_nome}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAtendimentoAusencia(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Deseja manter a vaga bloqueada ou liberar +1 vaga de volta para a recepção?
            </p>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                disabled={acaoEmAndamentoId === atendimentoAusencia.id}
                onClick={() => confirmarAusencia(true)}
                className="w-full min-h-[50px] px-4 rounded-xl bg-terreiro-700 hover:bg-terreiro-800 text-white font-bold text-sm transition"
              >
                Marcar ausente e LIBERAR +1 vaga
              </button>

              <button
                type="button"
                disabled={acaoEmAndamentoId === atendimentoAusencia.id}
                onClick={() => confirmarAusencia(false)}
                className="w-full min-h-[50px] px-4 rounded-xl border-2 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-sm transition"
              >
                Marcar como ausente apenas (manter vaga ocupada)
              </button>

              <button
                type="button"
                onClick={() => setAtendimentoAusencia(null)}
                className="w-full min-h-[44px] rounded-xl text-slate-600 font-semibold text-sm hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal RN02: Cadastro Manual */}
      {modalManualAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-terreiro-700" />
                <h3 className="text-lg font-extrabold text-slate-900">
                  Check-in Manual (Recepção)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalManualAberto(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarManual} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  Nome Completo do Consulente *
                </label>
                <input
                  type="text"
                  required
                  value={manualNome}
                  onChange={(e) => setManualNome(e.target.value)}
                  placeholder="Nome de quem está sem celular"
                  className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-slate-300 focus:border-terreiro-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  Telefone / WhatsApp (opcional)
                </label>
                <input
                  type="tel"
                  value={manualTelefone}
                  onChange={(e) => setManualTelefone(formatarTelefone(e.target.value))}
                  placeholder="(65) 99999-9999"
                  className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-slate-300 focus:border-terreiro-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  Entidade *
                </label>
                <select
                  value={manualEscalaId}
                  onChange={(e) => setManualEscalaId(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-slate-300 bg-white focus:border-terreiro-600 focus:outline-none"
                >
                  {escalas.map((esc) => (
                    <option
                      key={esc.escala_id}
                      value={esc.escala_id}
                      disabled={!esc.escala_ativa || esc.vagas_restantes <= 0}
                    >
                      {esc.nome_entidade} ({esc.medium_nome}) —{' '}
                      {!esc.escala_ativa
                        ? 'PAUSADO'
                        : esc.vagas_restantes <= 0
                          ? 'ESGOTADO'
                          : `${esc.vagas_restantes} vagas`}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2.5 min-h-[44px] px-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualPrimeiraVez}
                  onChange={(e) => setManualPrimeiraVez(e.target.checked)}
                  className="w-5 h-5 rounded text-terreiro-700"
                />
                <span className="text-sm font-semibold text-slate-800">
                  Primeira vez no terreiro
                </span>
              </label>

              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  Orientações / Observações do Cliente (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={manualOrientacoes}
                  onChange={(e) => setManualOrientacoes(e.target.value)}
                  placeholder="Anotações iniciais ou orientações para o cadastro..."
                  className="w-full p-3 rounded-xl border-2 border-slate-300 text-sm focus:border-terreiro-600 focus:outline-none resize-y"
                />
              </div>

              {erroManual && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 font-medium">
                  {erroManual}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalManualAberto(false)}
                  className="flex-1 min-h-[48px] rounded-xl border border-slate-300 font-bold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoManual}
                  className="flex-1 min-h-[48px] rounded-xl bg-terreiro-700 hover:bg-terreiro-800 text-white font-bold inline-flex items-center justify-center gap-2"
                >
                  {salvandoManual && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Gerar Senha</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajuste Rápido de Limite */}
      {modalLimiteAberto && escalaSelecionada && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">Ajustar Limite</h3>
              <button
                type="button"
                onClick={() => setModalLimiteAberto(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              {escalaSelecionada.nome_entidade} • Geradas:{' '}
              <strong>{escalaSelecionada.senhas_geradas}</strong>
            </p>

            <form onSubmit={salvarLimiteRapido} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-1">
                  Limite Total de Senhas
                </label>
                <input
                  type="number"
                  min={0}
                  value={novoLimiteInput}
                  onChange={(e) => setNovoLimiteInput(Number(e.target.value))}
                  className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300 font-bold text-lg text-center"
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  await alternarStatusEscala(
                    escalaSelecionada.escala_id,
                    !escalaSelecionada.escala_ativa
                  );
                  setModalLimiteAberto(false);
                  await carregarDados();
                }}
                className={`w-full min-h-[44px] rounded-xl font-bold text-sm border ${
                  escalaSelecionada.escala_ativa
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}
              >
                {escalaSelecionada.escala_ativa
                  ? 'Pausar Novas Senhas Temporariamente'
                  : 'Retomar Emissão de Senhas'}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalLimiteAberto(false)}
                  className="flex-1 min-h-[46px] rounded-xl border border-slate-300 font-bold text-slate-700"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[46px] rounded-xl bg-terreiro-700 text-white font-bold"
                >
                  Salvar Limite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ficha e Orientações do Consulente */}
      {atendimentoFicha && (
        <FichaConsulenteModal
          atendimento={atendimentoFicha}
          nomeEntidade={escalaSelecionada?.nome_entidade}
          mediumNome={escalaSelecionada?.medium_nome}
          cambonoNome={escalaSelecionada?.cambono_nome}
          giraTitulo={escalas[0]?.gira_titulo}
          dataGira={escalas[0]?.data_gira}
          onClose={() => setAtendimentoFicha(null)}
          onSalvo={carregarDados}
        />
      )}
    </div>
  );
}

