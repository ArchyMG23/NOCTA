import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { I18nProvider } from './i18n/I18nContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AgeGateModal } from './components/AgeGateModal';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { LegalPage } from './pages/LegalPage';
import { DashboardPage } from './pages/DashboardPage';
import { IndividualSpacePage } from './pages/IndividualSpacePage';
import { CoupleSpacePage } from './pages/CoupleSpacePage';
import { UniversesPage } from './pages/UniversesPage';
import { FavoritesHistoryPage } from './pages/FavoritesHistoryPage';
import { AdminPage } from './pages/AdminPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, isEmailVerified, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#100D10] text-[#B8AAB0] flex items-center justify-center text-sm">
        NOCTA...
      </div>
    );
  }

  if (!firebaseUser || !isEmailVerified) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <AgeGateModal />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/privacy" element={<LegalPage docType="privacy" />} />
              <Route path="/terms" element={<LegalPage docType="terms" />} />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/space"
                element={
                  <ProtectedRoute>
                    <IndividualSpacePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/couple"
                element={
                  <ProtectedRoute>
                    <CoupleSpacePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/universes"
                element={
                  <ProtectedRoute>
                    <UniversesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/universes/:slug"
                element={
                  <ProtectedRoute>
                    <UniversesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/favorites"
                element={
                  <ProtectedRoute>
                    <FavoritesHistoryPage />
                  </ProtectedRoute>
                }
              />

              {/* Server-verified protected Admin Portal */}
              <Route path="/admin/*" element={<AdminPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
