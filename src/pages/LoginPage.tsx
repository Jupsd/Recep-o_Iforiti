import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  extrairMensagemErro,
  LOGO_TERREIRO_URL,
  TERREIRO_NOME,
  TERREIRO_SUBTITULO,
} from '../lib/format';
import type { PerfilUsuario } from '../types/database';

function getDestinoPadrao(perfil: PerfilUsuario): string {
  return perfil === 'ADMIN' ? '/admin/gira' : '/painel';
}

export function LoginPage() {
  const { perfil, signIn, isModoLocal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const rotaOrigem = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (perfil) {
      const alvo =
        rotaOrigem && rotaOrigem !== '/login'
          ? rotaOrigem
          : getDestinoPadrao(perfil.perfil);
      navigate(alvo, { replace: true });
    }
  }, [perfil, rotaOrigem, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const logado = await signIn(email, password);
      const alvo =
        rotaOrigem && rotaOrigem !== '/login'
          ? rotaOrigem
          : getDestinoPadrao(logado.perfil);
      navigate(alvo, { replace: true });
    } catch (err) {
      setErro(extrairMensagemErro(err, 'Falha ao entrar. Verifique suas credenciais.'));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-terreiro-900 to-slate-100 flex flex-col justify-center p-4">
      <div className="max-w-md w-full mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-terreiro-100 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Check-in</span>
          </Link>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/15 text-white border border-white/20">
            {isModoLocal ? 'Modo Local / Demo' : 'Supabase Conectado'}
          </span>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-7">
          <div className="text-center mb-6">
            <img
              src={LOGO_TERREIRO_URL}
              alt={`${TERREIRO_NOME} — ${TERREIRO_SUBTITULO}`}
              className="w-24 h-24 object-contain mx-auto mb-3 rounded-2xl"
            />
            <p className="text-xs font-bold uppercase tracking-wider text-terreiro-700">
              {TERREIRO_NOME}
            </p>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Acesso da Equipe</h1>
            <p className="text-sm text-slate-600 mt-1">
              {TERREIRO_SUBTITULO}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-bold text-slate-800 mb-1.5"
              >
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300 text-base text-slate-900 focus:border-terreiro-600 focus:outline-none transition"
              />
            </div>

            <div>
              <label
                htmlFor="login-senha"
                className="block text-sm font-bold text-slate-800 mb-1.5"
              >
                Senha
              </label>
              <input
                id="login-senha"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[48px] px-4 rounded-xl border-2 border-slate-300 text-base text-slate-900 focus:border-terreiro-600 focus:outline-none transition"
              />
            </div>

            {erro && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm font-medium"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full min-h-[50px] rounded-2xl bg-terreiro-700 hover:bg-terreiro-800 disabled:bg-slate-400 text-white font-bold text-base inline-flex items-center justify-center gap-2 shadow-sm transition"
            >
              {carregando ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Entrar no Sistema</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

