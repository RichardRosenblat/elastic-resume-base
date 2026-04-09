/**
 * @file App.tsx — Root component that wires together the application shell.
 *
 * Responsibilities:
 * - Applies the configurable theme (read from `theme.json`) via
 *   {@link AppThemeProvider}, which also bridges to MUI's ThemeProvider.
 * - Initialises i18next (via the side-effect import of `./i18n`).
 * - Wraps the whole tree in {@link AuthProvider} so every page can call
 *   {@link useAuth}.
 * - Declares the React Router v7 route tree, including:
 *   - `/login` — public, redirects to `/` when already authenticated.
 *   - `/*` (authenticated) — nested inside {@link ProtectedRoute} +
 *     {@link AppLayout}.
 *   - `/users` — additionally guarded by `adminOnly`.
 *   - `*` catch-all → {@link NotFoundPage}.
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppThemeProvider } from './theme';
import './i18n';

import AppLayout from './components/Layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/Login/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import UsersPage from './pages/Users/UsersPage';
import ResumesPage from './pages/Resumes/ResumesPage';
import SearchPage from './pages/Search/SearchPage';
import DocumentsPage from './pages/Documents/DocumentsPage';
import AccountPage from './pages/Account/AccountPage';
import NotFoundPage from './pages/NotFound/NotFoundPage';
import SystemStatusPage from './pages/SystemStatus/SystemStatusPage';
import BrandingMetaManager from './components/BrandingMetaManager';
import { ToastProvider } from './contexts/toast-context';
import { useRateLimitNotifier } from './hooks/useRateLimitNotifier';
import { useAccountStatusNotifier } from './hooks/useAccountStatusNotifier';

/**
 * Mounts the global rate-limit toast notifier. Must be rendered inside
 * `ToastProvider`.
 */
function RateLimitNotifier() {
  useRateLimitNotifier();
  return null;
}

/**
 * Mounts the global account-status toast notifier. Must be rendered inside
 * `ToastProvider`.
 */
function AccountStatusNotifier() {
  useAccountStatusNotifier();
  return null;
}

/**
 * Root React component. Renders the full route tree inside the
 * {@link AppThemeProvider}, `BrowserRouter`, and `AuthProvider`.
 */
export default function App() {
  return (
    <AppThemeProvider>
      <ToastProvider>
        <RateLimitNotifier />
        <AccountStatusNotifier />
        <BrowserRouter>
          <BrandingMetaManager />
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/resumes" element={<ResumesPage />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/documents" element={<DocumentsPage />} />
                  <Route path="/account" element={<AccountPage />} />
                </Route>
              </Route>
              <Route element={<ProtectedRoute adminOnly />}>
                <Route element={<AppLayout />}>
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/system-status" element={<SystemStatusPage />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </AppThemeProvider>
  );
}
