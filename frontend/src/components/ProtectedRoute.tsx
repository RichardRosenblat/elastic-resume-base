import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import { Box, Typography, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ProtectedRouteProps {
  adminOnly?: boolean;
  children?: ReactNode;
}

export default function ProtectedRoute({ adminOnly = false, children }: ProtectedRouteProps) {
  const { currentUser, userProfile, loading, isAdmin, logout } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return <LoadingSpinner message={t('common.loading')} />;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
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
