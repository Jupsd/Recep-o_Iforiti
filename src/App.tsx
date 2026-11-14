import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CheckinPage } from './pages/CheckinPage';
import { SenhaPage } from './pages/SenhaPage';
import { LoginPage } from './pages/LoginPage';
import { PainelCambonoPage } from './pages/PainelCambonoPage';
import { AdminGiraPage } from './pages/admin/AdminGiraPage';
import { AdminCadastrosPage } from './pages/admin/AdminCadastrosPage';
import { AdminRelatoriosPage } from './pages/admin/AdminRelatoriosPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          {/* Fase 2: Fluxo Público */}
          <Route path="/" element={<CheckinPage />} />
          <Route path="/senha" element={<SenhaPage />} />

          {/* Fase 3: Autenticação e Painel do Cambono */}
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/painel"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'CAMBONO']}>
                <PainelCambonoPage />
              </ProtectedRoute>
            }
          />

          {/* Fase 4: Área Administrativa */}
          <Route
            path="/admin"
            element={<Navigate to="/admin/gira" replace />}
          />
          <Route
            path="/admin/gira"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminGiraPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/cadastros"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminCadastrosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/relatorios"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminRelatoriosPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

