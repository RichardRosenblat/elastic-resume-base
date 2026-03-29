/**
 * @file PendingApprovalPage.tsx — Account pending approval screen.
 *
 * Shown when a user has successfully authenticated with Firebase but their
 * platform account has `enable = false` (i.e. an admin has not yet
 * approved them). Provides a sign-out button so the user can try a
 * different account.
 */
import { Box, Typography, Button, Card, CardContent } from '@mui/material';
import { HourglassEmpty as HourglassIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/auth-context';
import { useNavigate } from 'react-router-dom';

export default function PendingApprovalPage() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    void navigate('/login');
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
    >
      <Card sx={{ maxWidth: 480, textAlign: 'center' }}>
        <CardContent sx={{ p: 4 }}>
          <HourglassIcon color="warning" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" gutterBottom>{t('pending.title')}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {t('pending.message')}
          </Typography>
          <Button variant="contained" color="warning" onClick={() => { void handleLogout(); }}>
            {t('pending.logout')}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
