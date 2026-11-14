import React from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { possuiPermissao, useAuth } from '../contexts/AuthContext';
import type { PerfilUsuario } from '../types/database';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: PerfilUsuario[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { perfil, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <Loader2 className="w-10 h-10 text-terreiro-700 animate-spin mb-3" />
        <p className="text-slate-600 font-medium">Verificando acesso da equipe...</p>
      </div>
    );
  }

  if (!perfil) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!possuiPermissao(perfil, allowedRoles)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-red-200 p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Acesso Restrito</h1>
          <p className="text-sm text-slate-600 mb-6">
            Esta área é exclusiva para administradores do terreiro. Seu perfil atual é{' '}
            <span className="font-semibold">{perfil.perfil}</span>.
          </p>
          <Link
            to="/painel"
            className="inline-flex items-center justify-center w-full min-h-[48px] rounded-xl bg-terreiro-700 text-white font-semibold hover:bg-terreiro-800 transition"
          >
            Voltar ao Painel
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
