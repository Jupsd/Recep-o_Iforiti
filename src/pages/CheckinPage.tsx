import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  Building2,
  CalendarX2,
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserCheck,
} from 'lucide-react';
import {
  limparComprovantesExcetoGira,
  limparComprovantesLocais,
  obterComprovanteAtivoLocal,
  salvarComprovanteLocal,
} from '../lib/comprovanteStorage';
import {
  extrairMensagemErro,
  formatarDataBR,
  formatarTelefone,
  limparDigitos,
  validarTelefoneBR,
  LOGO_TERREIRO_URL,
  TERREIRO_NOME,
  TERREIRO_SUBTITULO,
} from '../lib/format';
import {
  gerarSenhaConsulente,
  getDisponibilidadeGiraAberta,
  subscribeFilaGira,
  verificarTelefoneCadastrado,
} from '../services/dataService';
import type { DisponibilidadeGira } from '../types/database';

export function CheckinPage() {
  const navigate = useNavigate();

  const [escalas, setEscalas] = useState<DisponibilidadeGira[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [idade, setIdade] = useState('');
  const [outroTerreiro, setOutroTerreiro] = useState(false);
  const [nomeOutroTerreiro, setNomeOutroTerreiro] = useState('');
  const [primeiraVez, setPrimeiraVez] = useState(false);
  const [escalaSelecionada, setEscalaSelecionada] = useState<string>('');

  const [verificandoTel, setVerificandoTel] = useState(false);
  const [feedbackTel, setFeedbackTel] = useState<{
    tipo: 'sucesso' | 'aviso' | 'erro';
    mensagem: string;
  } | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const idadeNumero = idade.trim() ? parseInt(idade, 10) : null;
  const ehIdoso = idadeNumero !== null && !Number.isNaN(idadeNumero) && idadeNumero >= 60;

  const carregarGira = useCallback(async () => {
    try {
      setErroCarga(null);
      const dados = await getDisponibilidadeGiraAberta();
      setEscalas(dados);

      if (dados.length === 0) {
        limparComprovantesLocais();
      } else {
        const giraId = dados[0].gira_id;
        limparComprovantesExcetoGira(giraId);
        const salvo = obterComprovanteAtivoLocal(giraId);
        if (salvo) {
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
      if (salvoOffline) {
        navigate('/senha', { replace: true });
        return;
      }
      setErroCarga(extrairMensagemErro(err, 'Não foi possível carregar os dados da gira.'));
    } finally {
      setCarregando(false);
    }
  }, [navigate]);

  useEffect(() => {
    carregarGira();
    const unsubscribe = subscribeFilaGira(() => {
      carregarGira();
    });
    return () => unsubscribe();
  }, [carregarGira]);

  const giraInfo = escalas[0];

  async function handleTelefoneChange(novoValor: string) {
    const formatado = formatarTelefone(novoValor);
    setTelefone(formatado);

    const digitos = limparDigitos(formatado);
    if (digitos.length < 10) {
      setFeedbackTel(null);
      return;
    }

    const val = validarTelefoneBR(formatado);
    if (!val.valido) {
      setFeedbackTel({
        tipo: 'erro',
        mensagem: val.motivo || 'Telefone inválido.',
      });
      return;
    }

    // Telefone válido - verificar se já existe no terreiro
    setVerificandoTel(true);
    setFeedbackTel(null);
    try {
      const info = await verificarTelefoneCadastrado(formatado);
      if (info.encontrado) {
        if (info.jaNaGiraAberta) {
          setFeedbackTel({
            tipo: 'aviso',
            mensagem: `Atenção: este telefone já possui a senha #${String(info.numeroSenhaGiraAberta).padStart(2, '0')} gerada na gira de hoje!`,
          });
        } else {
          setFeedbackTel({
            tipo: 'sucesso',
            mensagem: 'Consulente identificado no sistema! Dados preenchidos automaticamente.',
          });
        }

        // Auto-preencher dados encontrados se ainda não alterados
        if (info.consulente_nome && (!nome.trim() || nome.trim().length < 3)) {
          setNome(info.consulente_nome);
        }
        if (info.idade !== undefined && info.idade !== null && !idade.trim()) {
          setIdade(String(info.idade));
        }
        if (info.outro_terreiro) {
          setOutroTerreiro(true);
          if (info.nome_outro_terreiro && !nomeOutroTerreiro.trim()) {
            setNomeOutroTerreiro(info.nome_outro_terreiro);
          }
        }
      } else {
        setFeedbackTel(null);
      }
    } catch {
      // Ignora erro de rede na checagem assíncrona
    } finally {
      setVerificandoTel(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErroEnvio(null);

    if (giraInfo && obterComprovanteAtivoLocal(giraInfo.gira_id)) {
      navigate('/senha', { replace: true });
      return;
    }

    if (nome.trim().length < 3) {
      setErroEnvio('Por favor, informe seu nome completo.');
      return;
    }

    const valTel = validarTelefoneBR(telefone);
    if (!valTel.valido) {
      setErroEnvio(valTel.motivo || 'Informe um WhatsApp / Telefone válido com DDD.');
      return;
    }

    if (outroTerreiro && !nomeOutroTerreiro.trim()) {
      setErroEnvio('Por favor, informe o nome da outra casa espiritual ou terreiro.');
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
        idade: idadeNumero,
        preferencial: ehIdoso,
        outroTerreiro,
        nomeOutroTerreiro: outroTerreiro ? nomeOutroTerreiro.trim() : null,
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
                  <div className="relative">
                    <input
                      id="telefone-consulente"
                      type="tel"
                      inputMode="tel"
                      required
                      autoComplete="tel"
                      value={telefone}
                      onChange={(e) => handleTelefoneChange(e.target.value)}
                      placeholder="(65) 99999-9999"
                      className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:border-terreiro-600 focus:outline-none transition"
                    />
                    {verificandoTel && (
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-terreiro-700 font-semibold bg-white px-1">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verificando...</span>
                      </div>
                    )}
                  </div>

                  {feedbackTel && (
                    <div
                      className={`mt-2 p-2.5 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                        feedbackTel.tipo === 'sucesso'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : feedbackTel.tipo === 'aviso'
                            ? 'bg-amber-50 text-amber-900 border border-amber-300'
                            : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {feedbackTel.tipo === 'sucesso' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <span>{feedbackTel.mensagem}</span>
                    </div>
                  )}
                </div>

                {/* Idade e Prioridade Idoso */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="idade-consulente"
                      className="block text-sm font-bold text-slate-800"
                    >
                      Idade (anos)
                    </label>
                    {ehIdoso && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                        <Award className="w-3.5 h-3.5 text-amber-700" />
                        <span>Prioridade Idoso (60+)</span>
                      </span>
                    )}
                  </div>
                  <input
                    id="idade-consulente"
                    type="number"
                    min="1"
                    max="120"
                    inputMode="numeric"
                    value={idade}
                    onChange={(e) => setIdade(e.target.value)}
                    placeholder="Ex: 65"
                    className={`w-full min-h-[48px] px-4 rounded-xl border-2 bg-white text-base text-slate-900 placeholder:text-slate-400 focus:outline-none transition ${
                      ehIdoso
                        ? 'border-amber-400 focus:border-amber-600 bg-amber-50/30'
                        : 'border-slate-300 focus:border-terreiro-600'
                    }`}
                  />
                  <p className="text-[11px] text-slate-500">
                    Consulentes com 60 anos ou mais têm prioridade automática no atendimento.
                  </p>
                </div>

                {/* Checkbox Outro Terreiro */}
                <div className="space-y-2">
                  <label className="flex items-center gap-3 min-h-[48px] px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition">
                    <input
                      type="checkbox"
                      checked={outroTerreiro}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setOutroTerreiro(checked);
                        if (!checked) setNomeOutroTerreiro('');
                      }}
                      className="w-5 h-5 rounded border-slate-400 text-terreiro-700 focus:ring-terreiro-600"
                    />
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-terreiro-700" />
                      <span className="text-sm font-semibold text-slate-800">
                        É de outro terreiro / casa espiritual?
                      </span>
                    </div>
                  </label>

                  {outroTerreiro && (
                    <div className="p-3.5 rounded-2xl bg-terreiro-50/70 border-2 border-terreiro-200 space-y-1.5 transition-all">
                      <label
                        htmlFor="nome-outro-terreiro"
                        className="block text-xs font-bold uppercase tracking-wider text-terreiro-900"
                      >
                        Nome da Casa Espiritual / Terreiro <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="nome-outro-terreiro"
                        type="text"
                        value={nomeOutroTerreiro}
                        onChange={(e) => setNomeOutroTerreiro(e.target.value)}
                        placeholder="Ex: Tenda Espírita Caboclo das Matas"
                        className="w-full min-h-[44px] px-3.5 rounded-xl border border-terreiro-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-terreiro-600 focus:outline-none"
                      />
                    </div>
                  )}
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

