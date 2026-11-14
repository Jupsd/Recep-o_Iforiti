import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Printer,
  QrCode,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import {
  extrairMensagemErro,
  formatarDataBR,
  hojeISO,
  LOGO_TERREIRO_URL,
  TERREIRO_NOME,
  TERREIRO_SUBTITULO,
} from '../../lib/format';
import {
  abrirNovaGira,
  adicionarEscalaNaGira,
  ajustarLimiteEscala,
  alternarStatusEscala,
  encerrarGira,
  excluirEscalaDaGira,
  getDisponibilidadeGiraAberta,
  getGiraAberta,
  listarEntidades,
  listarEquipeEspiritual,
  subscribeFilaGira,
} from '../../services/dataService';
import type {
  DisponibilidadeGira,
  Entidade,
  EquipeEspiritual,
  EscalaNovaInput,
  Gira,
} from '../../types/database';

export function AdminGiraPage() {
  const [giraAberta, setGiraAberta] = useState<Gira | null>(null);
  const [escalasAtuais, setEscalasAtuais] = useState<DisponibilidadeGira[]>([]);
  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [equipe, setEquipe] = useState<EquipeEspiritual[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Formulário Abrir Nova Gira
  const [titulo, setTitulo] = useState(`Gira de Atendimento - ${formatarDataBR(hojeISO())}`);
  const [dataGira, setDataGira] = useState(hojeISO());
  const [novasEscalas, setNovasEscalas] = useState<EscalaNovaInput[]>([]);
  const [abrindoGira, setAbrindoGira] = useState(false);

  // Adicionar escala extra em gira já aberta
  const [mostrarAddExtra, setMostrarAddExtra] = useState(false);
  const [extraEscala, setExtraEscala] = useState<EscalaNovaInput>({
    entidade_id: '',
    medium_id: '',
    cambono_id: null,
    limite_senhas: 15,
  });

  // Encerramento RN03
  const [modalEncerrarAberto, setModalEncerrarAberto] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  // QR Code
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);
  const [copiadoCurto, setCopiadoCurto] = useState(false);
  const [copiadoDireto, setCopiadoDireto] = useState(false);

  const mediunsAtivos = equipe.filter((m) => m.tipo === 'MEDIUM' && m.ativo);
  const cambonosAtivos = equipe.filter((m) => m.tipo === 'CAMBONO' && m.ativo);
  const entidadesAtivas = entidades.filter((e) => e.ativo);

  const urlPublicaCheckin = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const urlCurtaOficial = 'https://is.gd/iforiti';

  const carregarTudo = useCallback(async () => {
    try {
      setErro(null);
      const [gira, disp, ents, eq] = await Promise.all([
        getGiraAberta(),
        getDisponibilidadeGiraAberta(),
        listarEntidades(),
        listarEquipeEspiritual(),
      ]);

      setGiraAberta(gira);
      setEscalasAtuais(disp);
      setEntidades(ents);
      setEquipe(eq);

      const entsAtivas = ents.filter((e) => e.ativo);
      const medsAtivos = eq.filter((m) => m.tipo === 'MEDIUM' && m.ativo);
      const camsAtivos = eq.filter((m) => m.tipo === 'CAMBONO' && m.ativo);

      setNovasEscalas((prev) => {
        if (prev.length > 0) return prev;
        if (entsAtivas.length === 0 || medsAtivos.length === 0) return [];
        return [
          {
            entidade_id: entsAtivas[0].id,
            medium_id: medsAtivos[0].id,
            cambono_id: camsAtivos[0]?.id ?? null,
            limite_senhas: 15,
          },
        ];
      });

      setExtraEscala((prev) => ({
        entidade_id: prev.entidade_id || entsAtivas[0]?.id || '',
        medium_id: prev.medium_id || medsAtivos[0]?.id || '',
        cambono_id: prev.cambono_id ?? camsAtivos[0]?.id ?? null,
        limite_senhas: prev.limite_senhas || 15,
      }));
    } catch (err) {
      setErro(extrairMensagemErro(err, 'Erro ao carregar gestão da gira.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarTudo();
    const unsub = subscribeFilaGira(() => {
      carregarTudo();
    });
    return () => unsub();
  }, [carregarTudo]);

  function adicionarLinhaEscala() {
    setNovasEscalas((prev) => [
      ...prev,
      {
        entidade_id: entidadesAtivas[0]?.id ?? '',
        medium_id: mediunsAtivos[0]?.id ?? '',
        cambono_id: cambonosAtivos[0]?.id ?? null,
        limite_senhas: 15,
      },
    ]);
  }

  function atualizarLinhaEscala(idx: number, patch: Partial<EscalaNovaInput>) {
    setNovasEscalas((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  }

  function removerLinhaEscala(idx: number) {
    setNovasEscalas((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleAbrirGira(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!titulo.trim()) {
      setErro('Informe um título para a gira.');
      return;
    }
    const validas = novasEscalas.filter((s) => s.entidade_id && s.medium_id);
    if (validas.length === 0) {
      setErro('Adicione ao menos uma entidade e médium válidos na escala.');
      return;
    }

    setAbrindoGira(true);
    try {
      await abrirNovaGira({
        titulo: titulo.trim(),
        dataGira,
        escalas: validas,
      });
      await carregarTudo();
    } catch (err) {
      setErro(extrairMensagemErro(err));
    } finally {
      setAbrindoGira(false);
    }
  }

  async function handleAdicionarEscalaExtra(e: React.FormEvent) {
    e.preventDefault();
    if (!giraAberta || !extraEscala.entidade_id || !extraEscala.medium_id) return;
    try {
      await adicionarEscalaNaGira(giraAberta.id, extraEscala);
      setMostrarAddExtra(false);
      await carregarTudo();
    } catch (err) {
      setErro(extrairMensagemErro(err));
    }
  }

  async function handleAjustarLimite(escalaId: string, novoLimite: number) {
    try {
      await ajustarLimiteEscala(escalaId, novoLimite);
      await carregarTudo();
    } catch (err) {
      setErro(extrairMensagemErro(err));
    }
  }

  async function handleAlternarEscala(escalaId: string, ativoAtual: boolean) {
    try {
      await alternarStatusEscala(escalaId, !ativoAtual);
      await carregarTudo();
    } catch (err) {
      setErro(extrairMensagemErro(err));
    }
  }

  async function handleExcluirEscala(
    escalaId: string,
    nomeEntidade: string,
    senhasGeradas: number
  ) {
    const aviso =
      senhasGeradas > 0
        ? ` ATENÇÃO: já existem ${senhasGeradas} senha(s) gerada(s) que também serão removidas.`
        : '';
    if (
      !window.confirm(
        `Confirma excluir "${nomeEntidade}" do Controle de Vagas desta gira?${aviso}`
      )
    ) {
      return;
    }
    try {
      await excluirEscalaDaGira(escalaId);
      await carregarTudo();
    } catch (err) {
      setErro(extrairMensagemErro(err));
    }
  }

  async function handleEncerrarGira() {
    if (!giraAberta) return;
    setEncerrando(true);
    try {
      await encerrarGira(giraAberta.id);
      setModalEncerrarAberto(false);
      setNovasEscalas([]);
      await carregarTudo();
    } catch (err) {
      setErro(extrairMensagemErro(err));
    } finally {
      setEncerrando(false);
    }
  }

  function baixarQrPng() {
    const canvas = qrWrapperRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `qrcode-recepcao-iforiti-${giraAberta?.data_gira || hojeISO()}.png`;
    link.click();
  }

  async function copiarTexto(texto: string, tipo: 'curto' | 'direto') {
    try {
      await navigator.clipboard.writeText(texto);
      if (tipo === 'curto') {
        setCopiadoCurto(true);
        setTimeout(() => setCopiadoCurto(false), 2500);
      } else {
        setCopiadoDireto(true);
        setTimeout(() => setCopiadoDireto(false), 2500);
      }
    } catch {
      // Ignore clipboard deny
    }
  }

  const totalNaFilaGeral = escalasAtuais.reduce((acc, e) => acc + e.na_fila, 0);

  return (
    <AdminLayout>
      {carregando ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-terreiro-700 animate-spin mb-2" />
          <p className="text-sm text-slate-600">Carregando dados da gira...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm font-semibold">
              {erro}
            </div>
          )}

          {!giraAberta ? (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Abrir Nova Gira do Dia
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Os registros de consulentes e a emissão de senhas ficam bloqueados até que você abra a gira abaixo. Configure o título, data e escalas do dia para liberar o QR Code.
                </p>
              </div>

              {(entidadesAtivas.length === 0 || mediunsAtivos.length === 0) && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
                  Para abrir uma gira, certifique-se de ter pelo menos uma entidade e um médium ativos em{' '}
                  <Link to="/admin/cadastros" className="underline font-bold">
                    Cadastros Base
                  </Link>
                  .
                </div>
              )}

              <form onSubmit={handleAbrirGira} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">
                      Título da Gira *
                    </label>
                    <input
                      type="text"
                      required
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex: Gira de Caboclos - 14/11/2026"
                      className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300 focus:border-terreiro-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-800 mb-1.5">
                      Data da Gira *
                    </label>
                    <input
                      type="date"
                      required
                      value={dataGira}
                      onChange={(e) => setDataGira(e.target.value)}
                      className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300 focus:border-terreiro-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Escala do Dia (Entidades, Médiuns e Limites)
                    </h3>
                    <button
                      type="button"
                      onClick={adicionarLinhaEscala}
                      disabled={entidadesAtivas.length === 0 || mediunsAtivos.length === 0}
                      className="inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl bg-terreiro-50 text-terreiro-800 border border-terreiro-200 text-sm font-bold hover:bg-terreiro-100 transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar Entidade</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {novasEscalas.map((linha, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                      >
                        <div className="sm:col-span-4">
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            Entidade *
                          </label>
                          <select
                            value={linha.entidade_id}
                            onChange={(e) =>
                              atualizarLinhaEscala(idx, { entidade_id: e.target.value })
                            }
                            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium"
                          >
                            {entidadesAtivas.map((ent) => (
                              <option key={ent.id} value={ent.id}>
                                {ent.nome_entidade}
                                {ent.linha ? ` (${ent.linha})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            Médium *
                          </label>
                          <select
                            value={linha.medium_id}
                            onChange={(e) =>
                              atualizarLinhaEscala(idx, { medium_id: e.target.value })
                            }
                            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium"
                          >
                            {mediunsAtivos.map((med) => (
                              <option key={med.id} value={med.id}>
                                {med.nome}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-xs font-bold text-slate-600 mb-1">
                            Cambono (Opcional)
                          </label>
                          <select
                            value={linha.cambono_id ?? ''}
                            onChange={(e) =>
                              atualizarLinhaEscala(idx, {
                                cambono_id: e.target.value || null,
                              })
                            }
                            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium"
                          >
                            <option value="">Sem cambono fixo</option>
                            {cambonosAtivos.map((cam) => (
                              <option key={cam.id} value={cam.id}>
                                {cam.nome}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2 flex items-end gap-2">
                          <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-600 mb-1">
                              Senhas *
                            </label>
                            <input
                              type="number"
                              min={0}
                              required
                              value={linha.limite_senhas}
                              onChange={(e) =>
                                atualizarLinhaEscala(idx, {
                                  limite_senhas: Math.max(0, Number(e.target.value)),
                                })
                              }
                              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-center"
                            />
                          </div>

                          {novasEscalas.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removerLinhaEscala(idx)}
                              title="Remover linha"
                              className="min-h-[44px] px-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={abrindoGira || novasEscalas.length === 0}
                  className="w-full sm:w-auto px-8 min-h-[52px] rounded-2xl bg-terreiro-700 hover:bg-terreiro-800 disabled:bg-slate-300 text-white font-extrabold text-base inline-flex items-center justify-center gap-2 shadow transition"
                >
                  {abrindoGira ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                  <span>Abrir Gira e Gerar QR Code</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Coluna Esquerda: QR Code da Recepção */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center space-y-4">
                <img
                  src={LOGO_TERREIRO_URL}
                  alt={`${TERREIRO_NOME} — ${TERREIRO_SUBTITULO}`}
                  className="w-24 h-24 object-contain rounded-2xl"
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-terreiro-800">
                    {TERREIRO_NOME}
                  </p>
                  <p className="text-xs font-semibold text-slate-600">
                    {TERREIRO_SUBTITULO}
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-extrabold uppercase print:hidden">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                  Gira Aberta
                </div>

                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {giraAberta.titulo}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {formatarDataBR(giraAberta.data_gira)}
                  </p>
                </div>

                <div
                  ref={qrWrapperRef}
                  className="p-4 rounded-2xl bg-white border-2 border-terreiro-200 shadow-inner print:border-0"
                >
                  <QRCodeCanvas
                    value={urlCurtaOficial}
                    size={210}
                    level="H"
                    includeMargin
                  />
                </div>

                {/* Link Encurtador Limpo */}
                <div className="w-full bg-emerald-50 rounded-xl p-3 border border-emerald-200 text-left space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase text-emerald-900 tracking-wider">
                      Link Encurtado Oficial
                    </span>
                    <button
                      type="button"
                      onClick={() => copiarTexto(urlCurtaOficial, 'curto')}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white inline-flex items-center gap-1 transition"
                    >
                      {copiadoCurto ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm font-black text-emerald-950 font-mono select-all">
                    {urlCurtaOficial}
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Sem &quot;github&quot; no nome — ideal para enviar pelo WhatsApp ou digitar no celular.
                  </p>
                </div>

                <div className="w-full bg-slate-50 rounded-xl p-2.5 border border-slate-200 flex items-center justify-between gap-2 print:hidden">
                  <div className="min-w-0 text-left">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Link Direto de Backup:
                    </span>
                    <span className="text-xs text-slate-600 truncate block font-mono">
                      {urlPublicaCheckin}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copiarTexto(urlPublicaCheckin, 'direto')}
                    className="shrink-0 px-2 py-1 rounded-lg bg-white border border-slate-300 text-[11px] font-bold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1"
                  >
                    {copiadoDireto ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={baixarQrPng}
                    className="w-full min-h-[46px] rounded-xl bg-terreiro-700 hover:bg-terreiro-800 text-white font-bold text-sm inline-flex items-center justify-center gap-2 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Imagem QR Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full min-h-[46px] rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm inline-flex items-center justify-center gap-2 transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir Cartaz da Recepção</span>
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  <QrCode className="w-3.5 h-3.5 inline mr-1" />
                  O consulente aponta a câmera do celular para este QR Code ou acessa <strong className="font-mono text-slate-800">is.gd/iforiti</strong> para retirar a senha sem precisar baixar aplicativo.
                </p>
              </div>

              {/* Coluna Direita: Controle em Tempo Real das Escalas & Encerramento */}
              <div className="lg:col-span-2 space-y-4 print:hidden">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900">
                        Controle de Limites em Tempo Real
                      </h3>
                      <p className="text-xs text-slate-500">
                        Ajuste as senhas ou pause uma entidade durante o andamento da gira (RF04).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMostrarAddExtra((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl bg-terreiro-50 text-terreiro-800 border border-terreiro-200 text-xs font-bold hover:bg-terreiro-100"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar Entidade</span>
                    </button>
                  </div>

                  {mostrarAddExtra && (
                    <form
                      onSubmit={handleAdicionarEscalaExtra}
                      className="p-4 rounded-2xl bg-terreiro-50 border border-terreiro-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
                    >
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Entidade
                        </label>
                        <select
                          value={extraEscala.entidade_id}
                          onChange={(e) =>
                            setExtraEscala((p) => ({ ...p, entidade_id: e.target.value }))
                          }
                          className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                        >
                          {entidadesAtivas.map((ent) => (
                            <option key={ent.id} value={ent.id}>
                              {ent.nome_entidade}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Médium
                        </label>
                        <select
                          value={extraEscala.medium_id}
                          onChange={(e) =>
                            setExtraEscala((p) => ({ ...p, medium_id: e.target.value }))
                          }
                          className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                        >
                          {mediunsAtivos.map((med) => (
                            <option key={med.id} value={med.id}>
                              {med.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Limite Senhas
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={extraEscala.limite_senhas}
                          onChange={(e) =>
                            setExtraEscala((p) => ({
                              ...p,
                              limite_senhas: Math.max(0, Number(e.target.value)),
                            }))
                          }
                          className="w-full min-h-[40px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-center"
                        />
                      </div>
                      <button
                        type="submit"
                        className="min-h-[40px] rounded-lg bg-terreiro-700 text-white text-xs font-bold"
                      >
                        Incluir na Gira
                      </button>
                    </form>
                  )}

                  <div className="space-y-3">
                    {escalasAtuais.map((esc) => (
                      <div
                        key={esc.escala_id}
                        className={`p-4 rounded-2xl border-2 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          esc.escala_ativa
                            ? 'bg-white border-slate-200'
                            : 'bg-slate-50 border-amber-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-extrabold text-slate-900">
                              {esc.nome_entidade}
                            </p>
                            {!esc.escala_ativa && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                                PAUSADA
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">
                            Médium: <strong>{esc.medium_nome}</strong>
                            {esc.cambono_nome ? ` • Cambono: ${esc.cambono_nome}` : ''}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1 text-xs font-semibold">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                              Geradas: {esc.senhas_geradas}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">
                              Atendidos: {esc.atendidos}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800">
                              Na fila: {esc.na_fila}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md ${
                                esc.vagas_restantes > 0
                                  ? 'bg-terreiro-50 text-terreiro-800'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              Restantes: {esc.vagas_restantes}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex items-center rounded-xl border border-slate-300 bg-slate-50">
                            <button
                              type="button"
                              onClick={() =>
                                handleAjustarLimite(
                                  esc.escala_id,
                                  Math.max(0, esc.limite_senhas - 1)
                                )
                              }
                              className="w-10 h-10 font-extrabold text-lg text-slate-700 hover:bg-slate-200 rounded-l-xl"
                            >
                              -
                            </button>
                            <span className="px-3 text-sm font-black text-slate-900">
                              {esc.limite_senhas}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleAjustarLimite(esc.escala_id, esc.limite_senhas + 1)
                              }
                              className="w-10 h-10 font-extrabold text-lg text-slate-700 hover:bg-slate-200 rounded-r-xl"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleAlternarEscala(esc.escala_id, esc.escala_ativa)
                            }
                            className={`min-h-[42px] px-3.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 border transition ${
                              esc.escala_ativa
                                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                                : 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                            }`}
                          >
                            {esc.escala_ativa ? (
                              <>
                                <PauseCircle className="w-4 h-4" />
                                <span>Pausar</span>
                              </>
                            ) : (
                              <>
                                <PlayCircle className="w-4 h-4" />
                                <span>Ativar</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleExcluirEscala(
                                esc.escala_id,
                                esc.nome_entidade,
                                esc.senhas_geradas
                              )
                            }
                            title="Excluir entidade desta gira"
                            className="min-h-[42px] px-3 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Encerramento da Gira */}
                <div className="bg-red-50 border border-red-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-extrabold text-red-950">Encerrar Gira Atual</h4>
                    <p className="text-xs text-red-800 mt-0.5">
                      Finaliza os atendimentos do dia e consolida os dados nos relatórios históricos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalEncerrarAberto(true)}
                    className="shrink-0 min-h-[48px] px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Encerrar Gira</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Confirmação Encerramento RN03 */}
      {modalEncerrarAberto && giraAberta && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Confirmar Encerramento da Gira?
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Todas as senhas que permanecerem como <strong>AGUARDANDO</strong> ({totalNaFilaGeral}{' '}
                  {totalNaFilaGeral === 1 ? 'pessoa' : 'pessoas'}) serão convertidas para{' '}
                  <strong>NÃO ATENDIDO</strong> e o QR Code será fechado.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalEncerrarAberto(false)}
                className="flex-1 min-h-[46px] rounded-xl border border-slate-300 font-bold text-slate-700"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={encerrando}
                onClick={handleEncerrarGira}
                className="flex-1 min-h-[46px] rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold inline-flex items-center justify-center gap-2"
              >
                {encerrando && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Sim, Encerrar Gira</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

