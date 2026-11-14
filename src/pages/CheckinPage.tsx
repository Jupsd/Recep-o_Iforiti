import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CalendarX2,
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Ticket,
  UserCheck,
} from 'lucide-react';
import {
  obterComprovanteAtivoLocal,
  salvarComprovanteLocal,
  definirComprovanteAtivoId,
  listarComprovantesLocais,
} from '../lib/comprovanteStorage';
import {
  extrairMensagemErro,
  formatarDataBR,
  formatarSenha,
  formatarTelefone,
  limparDigitos,
  LOGO_TERREIRO_URL,
  TERREIRO_NOME,
  TERREIRO_SUBTITULO,
} from '../lib/format';
import {
  gerarSenhaConsulente,
  getDisponibilidadeGiraAberta,
  subscribeFilaGira,
} from '../services/dataService';
import type { DisponibilidadeGira } from '../types/database';

export function CheckinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const permitirNova = searchParams.get('nova') === '1';

  const [escalas, setEscalas] = useState<DisponibilidadeGira[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [primeiraVez, setPrimeiraVez] = useState(false);
  const [escalaSelecionada, setEscalaSelecionada] = useState<string>('');

  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const carregarGira = useCallback(async () => {
    try {
      setErroCarga(null);
      const dados = await getDisponibilidadeGiraAberta();
      setEscalas(dados);

      if (dados.length > 0) {
        const giraId = dados[0].gira_id;
        const salvo = obterComprovanteAtivoLocal(giraId);
        if (salvo && !permitirNova) {
          navigate('/senha', { replace: true });
          return;
        }
        setEscalaSelecionada((atual) => {
          const aindaDisponivel = dados.find(
            (d) => d.escala_id === atual && d.escala_ativa && d.vagas_restantes > 0
          );
          if (aindaDisponivel) return atual;
          const primeiroDisponivel = dados.find(
            (d) => d.escala_ativa && d.vagas_restantes > 0
          );
          return primeiroDisponivel?.escala_id ?? '';
        });
      }
    } catch (err) {
      // Se estiver offline e houver comprovante salvo, redireciona para /senha (RNF02)
      const salvoOffline = obterComprovanteAtivoLocal();
      if (salvoOffline && !permitirNova) {
        navigate('/senha', { replace: true });
        return;
      }
      setErroCarga(extrairMensagemErro(err, 'Não foi possível carregar os dados da gira.'));
    } finally {
      setCarregando(false);
    }
  }, [navigate, permitirNova]);

  useEffect(() => {
    carregarGira();
    const unsubscribe = subscribeFilaGira(() => {
      carregarGira();
    });
    return () => unsubscribe();
  }, [carregarGira]);

  const giraInfo = escalas[0];
  const comprovantesDaGira = giraInfo ? listarComprovantesLocais(giraInfo.gira_id) : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErroEnvio(null);

    if (nome.trim().length < 3) {
      setErroEnvio('Por favor, informe seu nome completo.');
      return;
    }

    const digitosTel = limparDigitos(telefone);
    if (digitosTel.length < 10) {
      setErroEnvio('Informe um WhatsApp / Telefone válido com DDD.');
      return;
    }

    if (!escalaSelecionada) {
      setErroEnvio('Selecione uma entidade disponível para atendimento.');
      return;
    }

    setEnviando(true);
    try {
      const comprovante = await gerarSenhaConsulente({
        escalaId: escalaSelecionada,
        nome: nome.trim(),
        telefone,
        primeiraVez,
        origem: 'QRCODE',
      });

      salvarComprovanteLocal(comprovante);
      navigate('/senha', {
        state: {
          jaExistia: Boolean(comprovante.ja_existia),
        },
      });
    } catch (err) {
      setErroEnvio(extrairMensagemErro(err, 'Não foi possível gerar sua senha.'));
      await carregarGira();
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-terreiro-700 animate-spin mb-3" />
        <p className="text-slate-600 font-medium text-center">
          Carregando gira e vagas disponíveis...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-terreiro-900 via-terreiro-800 to-slate-100 pb-10">
      {/* Cabeçalho Mobile-First */}
      <header className="max-w-lg mx-auto px-4 pt-5 pb-6 text-white">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={LOGO_TERREIRO_URL}
              alt={`${TERREIRO_NOME} — ${TERREIRO_SUBTITULO}`}
              className="w-14 h-14 rounded-2xl bg-white object-contain p-1 shadow-md border border-white/30 shrink-0"
            />
            <div className="min-w-0">
              <span className="text-[11px] uppercase tracking-wider text-terreiro-200 font-semibold block truncate">
                {TERREIRO_NOME}
              </span>
              <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
                {TERREIRO_SUBTITULO}
              </h1>
            </div>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Equipe</span>
          </Link>
        </div>

        {giraInfo ? (
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-4 py-3">
            <p className="text-xs text-terreiro-200 font-medium uppercase tracking-wide">
              Gira Aberta Hoje
            </p>
            <p className="text-base sm:text-lg font-bold text-white mt-0.5">
              {giraInfo.gira_titulo} • {formatarDataBR(giraInfo.data_gira)}
            </p>
          </div>
        ) : null}
      </header>

      <main className="max-w-lg mx-auto px-4">
        {erroCarga && (
          <div className="bg-white rounded-2xl shadow-md border border-red-200 p-5 text-center mb-4">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
            <p className="text-slate-800 font-semibold mb-1">Sem conexão no momento</p>
            <p className="text-sm text-slate-600 mb-4">{erroCarga}</p>
            <button
              type="button"
              onClick={carregarGira}
              className="inline-flex items-center justify-center gap-2 px-5 min-h-[48px] rounded-xl bg-terreiro-700 text-white font-semibold hover:bg-terreiro-800 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente
            </button>
          </div>
        )}

        {!erroCarga && escalas.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-lg border border-slate-200 p-7 text-center">
            <img
              src={LOGO_TERREIRO_URL}
              alt={`${TERREIRO_NOME} — ${TERREIRO_SUBTITULO}`}
              className="w-28 h-28 object-contain mx-auto mb-4 rounded-2xl"
            />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold mb-3">
              <CalendarX2 className="w-4 h-4" />
              <span>Registros Bloqueados no Momento</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Aguardando abertura da gira pelo Administrador
            </h2>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              Os registros e a retirada de senhas no aplicativo só são liberados após o Administrador iniciar a gira do dia no sistema.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={carregarGira}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-terreiro-700 text-white font-semibold hover:bg-terreiro-800 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Atualizar Página
              </button>
              <Link
                to="/login"
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition"
              >
                <UserCheck className="w-4 h-4" />
                Acesso Cambono / Admin
              </Link>
            </div>
          </div>
        ) : null}

        {!erroCarga && escalas.length > 0 && (
          <div className="space-y-4">
            {comprovantesDaGira.length > 0 && (
              <div className="bg-terreiro-50 border border-terreiro-300 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
                <div>
                  <p className="text-xs font-bold uppercase text-terreiro-800">
                    Você já possui senha salva nesta gira
                  </p>
                  <p className="text-sm text-terreiro-900 font-medium">
                    {formatarSenha(comprovantesDaGira[0].numero_senha)} •{' '}
                    {comprovantesDaGira[0].nome_entidade}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    definirComprovanteAtivoId(comprovantesDaGira[0].atendimento_id);
                    navigate('/senha');
                  }}
                  className="shrink-0 px-4 min-h-[44px] rounded-xl bg-terreiro-700 text-white text-sm font-bold hover:bg-terreiro-800 transition"
                >
                  Ver Senha
                </button>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-3xl shadow-xl border border-slate-200 p-5 sm:p-6 space-y-6"
            >
              {/* Bloco 1: Seus Dados */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="w-7 h-7 rounded-full bg-terreiro-700 text-white text-sm font-bold flex items-center justify-center">
                    1
                  </span>
                  <h2 className="text-base font-bold text-slate-900">Seus Dados</h2>
                </div>

                <div>
                  <label
                    htmlFor="nome-consulente"
                    className="block text-sm font-bold text-slate-800 mb-1.5"
                  >
                    Nome Completo <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="nome-consulente"
                    type="text"
                    required
                    autoComplete="name"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Maria Aparecida da Silva"
                    className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:border-terreiro-600 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label
                    htmlFor="telefone-consulente"
                    className="block text-sm font-bold text-slate-800 mb-1.5"
                  >
                    WhatsApp / Telefone <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="telefone-consulente"
                    type="tel"
                    inputMode="tel"
                    required
                    autoComplete="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
                    placeholder="(65) 99999-9999"
                    className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:border-terreiro-600 focus:outline-none transition"
                  />
                </div>

                <label className="flex items-center gap-3 min-h-[48px] px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                  <input
                    type="checkbox"
                    checked={primeiraVez}
                    onChange={(e) => setPrimeiraVez(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-400 text-terreiro-700 focus:ring-terreiro-600"
                  />
                  <span className="text-sm font-semibold text-slate-800">
                    É a minha primeira vez neste terreiro
                  </span>
                </label>

                <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2.5">
                  <ShieldCheck className="w-4 h-4 text-terreiro-700 shrink-0 mt-0.5" />
                  <span>
                    Coletamos apenas seu nome e telefone para uso exclusivo na organização interna dos atendimentos (LGPD).
                  </span>
                </div>
              </section>

              {/* Bloco 2: Escolha a Entidade */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="w-7 h-7 rounded-full bg-terreiro-700 text-white text-sm font-bold flex items-center justify-center">
                    2
                  </span>
                  <h2 className="text-base font-bold text-slate-900">
                    Escolha a Entidade para Atendimento
                  </h2>
                </div>

                <div className="space-y-2.5">
                  {escalas.map((item) => {
                    const pausada = !item.escala_ativa;
                    const esgotada = item.vagas_restantes <= 0;
                    const desabilitada = pausada || esgotada;
                    const selecionada = escalaSelecionada === item.escala_id && !desabilitada;

                    return (
                      <button
                        key={item.escala_id}
                        type="button"
                        disabled={desabilitada}
                        onClick={() => setEscalaSelecionada(item.escala_id)}
                        className={`w-full text-left rounded-2xl border-2 p-4 min-h-[72px] transition flex items-center justify-between gap-3 ${
                          desabilitada
                            ? 'bg-slate-100 border-slate-200 opacity-70 cursor-not-allowed'
                            : selecionada
                              ? 'bg-terreiro-50 border-terreiro-700 ring-2 ring-terreiro-200 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-terreiro-400'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              desabilitada
                                ? 'border-slate-400 bg-slate-200'
                                : selecionada
                                  ? 'border-terreiro-700 bg-terreiro-700'
                                  : 'border-slate-400 bg-white'
                            }`}
                          >
                            {selecionada && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                          </div>

                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-base leading-snug">
                              {item.nome_entidade}
                            </p>
                            <p className="text-sm text-slate-600 mt-0.5">
                              Médium: <span className="font-medium">{item.medium_nome}</span>
                              {item.linha ? ` • ${item.linha}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {pausada ? (
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-slate-200 text-slate-700">
                              PAUSADO
                            </span>
                          ) : esgotada ? (
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase bg-red-100 text-red-700 border border-red-200">
                              ESGOTADO
                            </span>
                          ) : (
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-extrabold ${
                                item.vagas_restantes <= 2
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-terreiro-100 text-terreiro-800 border border-terreiro-200'
                              }`}
                            >
                              {item.vagas_restantes}{' '}
                              {item.vagas_restantes === 1 ? 'vaga' : 'vagas'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {erroEnvio && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <span>{erroEnvio}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={enviando || !escalaSelecionada}
                className="w-full min-h-[54px] rounded-2xl bg-terreiro-700 hover:bg-terreiro-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold text-base tracking-wide shadow-md flex items-center justify-center gap-2 transition"
              >
                {enviando ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>GERANDO SENHA...</span>
                  </>
                ) : (
                  <>
                    <Ticket className="w-5 h-5" />
                    <span>CONFIRMAR E GERAR SENHA</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

