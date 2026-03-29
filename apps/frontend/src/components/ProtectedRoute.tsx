import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import LoadingSpinner from './LoadingSpinner';
import { Box, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

/** Props for the {@link ProtectedRoute} component. */
interface ProtectedRouteProps {
  /** When `true`, only users with `role === 'admin'` can access the route. */
  adminOnly?: boolean;
  children?: ReactNode;
}

/**
 * Route guard that enforces authentication, account enablement, and optional
 * admin-only access.
 *
 * - **Unauthenticated** → redirects to `/login`.
 * - **`enable = false`** → shows the Pending Approval screen.
 * - **`adminOnly = true` + non-admin** → shows a "Forbidden" message.
 * - **Authorised** → renders `children` or the nested `<Outlet />`.
 */
export default function ProtectedRoute({ adminOnly = false, children }: ProtectedRouteProps) {
  const { currentUser, userProfile, loading, isAdmin, logout } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (import.meta.env.DEV) {
    console.debug('ProtectedRoute auth state:', { currentUser, userProfile, isAdmin });
  }

  if (userProfile && !userProfile.enable) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={3}>
        <Typography variant="h4">{t('pending.title')}</Typography>
        <Typography variant="body1" textAlign="center" maxWidth={400}>{t('pending.message')}</Typography>
        <Button variant="contained" onClick={() => { void logout(); }}>{t('pending.logout')}</Button>
      </Box>
    );
  }

  if (adminOnly && !isAdmin) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={2}>
        <Typography variant="h4">{t('common.forbidden')}</Typography>
        <Typography variant="body1">{t('common.contactAdministrator')}</Typography>
      </Box>
    );
  }

  return children ? <>{children}</> : <Outlet />;
}
