import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BellRing,
  CalendarX2,
  CheckCircle2,
  Clock,
  Info,
  RefreshCw,
  Ticket,
  UserCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  atualizarStatusComprovanteLocal,
  limparComprovantesLocais,
  obterComprovanteAtivoLocal,
} from '../lib/comprovanteStorage';
import {
  desbloquearAudio,
  formatarDataBR,
  formatarHoraBR,
  formatarSenha,
  LOGO_TERREIRO_URL,
  notificarChamadaNoDispositivo,
  STATUS_ATENDIMENTO_LABEL,
  TERREIRO_NOME,
  TERREIRO_SUBTITULO,
  tocarSinoChamada,
} from '../lib/format';
import { getAtendimentoStatusEPosicao, subscribeAtendimento } from '../services/dataService';
import type { ComprovanteSenha, StatusAtendimento } from '../types/database';

function getBadgeEstilo(status: StatusAtendimento): {
  bg: string;
  dot: string;
  texto: string;
} {
  switch (status) {
    case 'EM_ATENDIMENTO':
      return {
        bg: 'bg-sky-100 text-sky-900 border-sky-400 animate-pulse',
        dot: 'bg-sky-600',
        texto: 'Em Atendimento Agora!',
      };
    case 'ATENDIDO':
      return {
        bg: 'bg-terreiro-100 text-terreiro-900 border-terreiro-300',
        dot: 'bg-terreiro-700',
        texto: 'Atendimento Finalizado',
      };
    case 'AUSENTE':
      return {
        bg: 'bg-amber-100 text-amber-900 border-amber-300',
        dot: 'bg-amber-600',
        texto: 'Ausente na Chamada',
      };
    case 'NAO_ATENDIDO':
      return {
        bg: 'bg-slate-200 text-slate-800 border-slate-300',
        dot: 'bg-slate-500',
        texto: 'Gira Encerrada (Não Atendido)',
      };
    default:
      return {
        bg: 'bg-sky-50 text-sky-900 border-sky-200',
        dot: 'bg-sky-600',
        texto: STATUS_ATENDIMENTO_LABEL[status],
      };
  }
}

export function SenhaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const jaExistia = Boolean((location.state as { jaExistia?: boolean } | null)?.jaExistia);

  const [comprovante, setComprovante] = useState<ComprovanteSenha | null>(() =>
    obterComprovanteAtivoLocal()
  );
  const [giraEncerrada, setGiraEncerrada] = useState(false);
  const [pessoasNaFrente, setPessoasNaFrente] = useState<number | null>(null);
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [sincronizando, setSincronizando] = useState(false);
  const [somAtivado, setSomAtivado] = useState(false);

  const statusAnteriorRef = useRef<StatusAtendimento | null>(comprovante?.status ?? null);

  const sincronizarComServidor = useCallback(
    async (alvo: ComprovanteSenha | null) => {
      if (!alvo) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setOnline(false);
        return;
      }

      setSincronizando(true);
      try {
        const res = await getAtendimentoStatusEPosicao(alvo.atendimento_id, alvo.gira_id);
        setOnline(true);
        if (res.giraEncerrada) {
          limparComprovantesLocais();
          setGiraEncerrada(true);
          setComprovante(null);
          return;
        }
        setPessoasNaFrente(res.pessoasNaFrente);
        if (res.status !== statusAnteriorRef.current) {
          if (res.status === 'EM_ATENDIMENTO') {
            notificarChamadaNoDispositivo();
          }
          statusAnteriorRef.current = res.status;
        }
        atualizarStatusComprovanteLocal(alvo.atendimento_id, res.status);
        const atualizadoLocal = obterComprovanteAtivoLocal(alvo.gira_id);
        setComprovante(atualizadoLocal || { ...alvo, status: res.status });
      } catch {
        setOnline(false);
      } finally {
        setSincronizando(false);
      }
    },
    []
  );

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      sincronizarComServidor(comprovante);
    };
    const onOffline = () => setOnline(false);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        sincronizarComServidor(comprovante);
      }
    };
    const onStorage = () => {
      const atual = obterComprovanteAtivoLocal();
      if (atual) setComprovante(atual);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [comprovante, sincronizarComServidor]);

  useEffect(() => {
    if (!comprovante) return;
    statusAnteriorRef.current = comprovante.status;
    sincronizarComServidor(comprovante);

    const unsubscribe = subscribeAtendimento(
      comprovante.atendimento_id,
      comprovante.escala_id,
      comprovante.gira_id,
      () => {
        sincronizarComServidor(comprovante);
      }
    );

    const intervalId = window.setInterval(() => {
      sincronizarComServidor(comprovante);
    }, 15000);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [comprovante?.atendimento_id, comprovante?.escala_id, comprovante?.gira_id, sincronizarComServidor]);

  if (!comprovante) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-md border border-slate-200 p-7 text-center">
          {giraEncerrada ? (
            <>
              <CalendarX2 className="w-12 h-12 text-amber-600 mx-auto mb-3" />
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold uppercase mb-3">
                Senha Sem Validade
              </div>
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                Gira Encerrada pelo Administrador
              </h1>
              <p className="text-sm text-slate-600 mb-6">
                Esta gira foi finalizada e todas as senhas emitidas perderam a validade. Quando uma nova gira for aberta, você poderá retirar uma nova senha.
              </p>
              <button
                type="button"
                onClick={() => navigate('/', { replace: true })}
                className="w-full min-h-[48px] rounded-xl bg-terreiro-700 text-white font-bold hover:bg-terreiro-800 transition"
              >
                Voltar à Tela Inicial
              </button>
            </>
          ) : (
            <>
              <Ticket className="w-12 h-12 text-terreiro-700 mx-auto mb-3" />
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                Nenhuma senha salva neste aparelho
              </h1>
              <p className="text-sm text-slate-600 mb-6">
                Faça seu check-in na tela inicial para retirar sua senha digital.
              </p>
              <button
                type="button"
                onClick={() => navigate('/', { replace: true })}
                className="w-full min-h-[48px] rounded-xl bg-terreiro-700 text-white font-bold hover:bg-terreiro-800 transition"
              >
                Ir para o Check-in
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const badge = getBadgeEstilo(comprovante.status);

  return (
    <div className="min-h-screen bg-gradient-to-b from-terreiro-900 via-terreiro-800 to-slate-100 pb-10">
      <header className="max-w-lg mx-auto px-4 pt-5 pb-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <img
            src={LOGO_TERREIRO_URL}
            alt={`${TERREIRO_NOME} — ${TERREIRO_SUBTITULO}`}
            className="w-12 h-12 rounded-2xl bg-white object-contain p-1 shadow border border-white/30 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-terreiro-200 truncate">
              {TERREIRO_NOME}
            </p>
            <p className="text-sm font-bold text-white truncate">{TERREIRO_SUBTITULO}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="inline-flex items-center gap-2 text-terreiro-100 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-sky-300" />
            <span>
              {jaExistia ? 'Comprovante Recuperado' : 'Senha Gerada com Sucesso!'}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              online
                ? 'bg-sky-900/50 border-sky-400/40 text-sky-100'
                : 'bg-amber-900/60 border-amber-400/50 text-amber-100'
            }`}
          >
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{online ? 'Ao Vivo' : 'Modo Offline'}</span>
          </span>
        </div>

        <p className="text-lg font-bold text-white">
          {comprovante.gira_titulo} • {formatarDataBR(comprovante.data_gira)}
        </p>

        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => {
              desbloquearAudio();
              tocarSinoChamada();
              setSomAtivado(true);
            }}
            className="w-full min-h-[38px] px-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-300" />
            <span>
              {somAtivado
                ? 'Sino de Chamada Ativado (Toque para testar)'
                : 'Toque para testar/ativar som no iPhone e Celular'}
            </span>
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 space-y-4">
        {comprovante.status === 'EM_ATENDIMENTO' && (
          <div className="bg-sky-600 text-white rounded-2xl p-4 shadow-lg flex items-center gap-3 animate-bounce">
            <BellRing className="w-7 h-7 shrink-0" />
            <div>
              <p className="font-extrabold text-base">CHEGOU A SUA VEZ!</p>
              <p className="text-sm text-sky-50 font-medium">
                👉 Por favor, dirija-se até a <span className="font-extrabold underline">RECEPÇÃO</span> do terreiro para seu atendimento com {comprovante.nome_entidade}.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 text-center space-y-5">
          {/* Card Principal da Senha */}
          <div className="bg-terreiro-50 border-2 border-terreiro-200 rounded-2xl py-6 px-4">
            <p className="text-xs font-extrabold uppercase tracking-widest text-terreiro-700 mb-1">
              Sua Senha É
            </p>
            <p className="text-6xl sm:text-7xl font-black text-terreiro-900 tracking-tight my-2">
              {formatarSenha(comprovante.numero_senha)}
            </p>
            <p className="text-xl font-extrabold text-slate-900 mt-3">
              {comprovante.nome_entidade}
            </p>
            {comprovante.linha && (
              <p className="text-xs font-semibold uppercase tracking-wider text-terreiro-700 mt-0.5">
                Linha: {comprovante.linha}
              </p>
            )}
            <p className="text-sm font-medium text-slate-600 mt-1.5">
              Médium: <span className="font-bold text-slate-800">{comprovante.medium_nome}</span>
            </p>
          </div>

          {/* Dados do Consulente e Status */}
          <div className="space-y-3">
            <div className="text-left bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Consulente</span>
                <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Check-in: {formatarHoraBR(comprovante.criado_em)}
                </span>
              </div>
              <p className="text-base font-bold text-slate-900">
                {comprovante.consulente_nome}
              </p>
            </div>

            <div
              className={`inline-flex items-center justify-center gap-2.5 w-full min-h-[48px] px-4 rounded-2xl border-2 font-bold text-sm ${badge.bg}`}
            >
              <span className={`w-3 h-3 rounded-full ${badge.dot}`} />
              <span>Status: {badge.texto}</span>
            </div>

            {comprovante.status === 'AGUARDANDO' && pessoasNaFrente !== null && (
              <p className="text-sm font-semibold text-terreiro-800 bg-terreiro-50 rounded-xl py-2.5 px-3 border border-terreiro-100">
                {pessoasNaFrente === 0
                  ? 'Você é o(a) próximo(a) da fila para esta entidade!'
                  : pessoasNaFrente === 1
                    ? 'Falta apenas 1 pessoa na sua frente.'
                    : `Faltam ${pessoasNaFrente} pessoas na sua frente.`}
              </p>
            )}
          </div>

          {/* Aviso Offline */}
          <div className="flex items-start gap-2.5 text-left bg-sky-50 border border-sky-200 rounded-2xl p-4 text-xs sm:text-sm text-sky-900">
            <Info className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Fique atento à chamada pelo nome ou número.</p>
              <p className="text-sky-800 mt-0.5">
                Limite de 1 senha por aparelho. Esta senha fica salva para consulta rápida e perde a validade automaticamente quando a gira for encerrada pelo Administrador.
              </p>
            </div>
          </div>

          {/* Ações */}
          <div className="pt-1 flex flex-col gap-2.5">
            <button
              type="button"
              disabled={sincronizando}
              onClick={() => sincronizarComServidor(comprovante)}
              className="w-full min-h-[48px] rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm inline-flex items-center justify-center gap-2 transition"
            >
              <RefreshCw className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} />
              <span>Atualizar Status Agora</span>
            </button>

            <Link
              to="/login"
              className="w-full min-h-[40px] text-xs font-semibold text-slate-500 hover:text-terreiro-700 inline-flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Acesso da Equipe (Cambono / Admin)</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

