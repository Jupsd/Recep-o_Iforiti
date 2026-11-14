import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarCog,
  ClipboardList,
  LogOut,
  QrCode,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LOGO_TERREIRO_URL, TERREIRO_NOME, TERREIRO_SUBTITULO } from '../lib/format';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { perfil, signOut, isModoLocal } = useAuth();
  const navigate = useNavigate();

  async function handleSair() {
    await signOut();
    navigate('/login');
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-semibold whitespace-nowrap transition ${
      isActive
        ? 'bg-terreiro-700 text-white shadow-sm'
        : 'text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={LOGO_TERREIRO_URL}
              alt={`${TERREIRO_NOME} — ${TERREIRO_SUBTITULO}`}
              className="w-12 h-12 rounded-xl bg-white object-contain border border-slate-200 p-0.5 shadow-sm shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  {TERREIRO_NOME}
                </h1>
                {isModoLocal && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    Modo Local
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {TERREIRO_SUBTITULO} • <span className="font-medium text-slate-700">{perfil?.nome}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/painel"
              className="inline-flex items-center gap-2 px-3.5 min-h-[42px] rounded-xl border border-terreiro-200 bg-terreiro-50 text-terreiro-800 text-sm font-semibold hover:bg-terreiro-100 transition"
            >
              <ClipboardList className="w-4 h-4" />
              <span>Painel Cambono</span>
            </Link>
            <Link
              to="/?nova=1"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
            >
              <QrCode className="w-4 h-4" />
              <span>Tela Pública</span>
            </Link>
            <button
              type="button"
              onClick={handleSair}
              className="inline-flex items-center gap-1.5 px-3 min-h-[42px] rounded-xl border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-sm font-medium transition"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        <nav className="max-w-6xl mx-auto px-4 pb-3 flex items-center gap-2 overflow-x-auto">
          <NavLink to="/admin/gira" className={navClass}>
            <CalendarCog className="w-4 h-4" />
            <span>Gestão da Gira & QR Code</span>
          </NavLink>
          <NavLink to="/admin/cadastros" className={navClass}>
            <Users className="w-4 h-4" />
            <span>Cadastros Base</span>
          </NavLink>
          <NavLink to="/admin/relatorios" className={navClass}>
            <BarChart3 className="w-4 h-4" />
            <span>Relatórios & Excel</span>
          </NavLink>
        </nav>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

