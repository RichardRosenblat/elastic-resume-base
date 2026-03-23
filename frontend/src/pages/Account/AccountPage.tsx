/**
 * @file AccountPage.tsx — User account settings page.
 *
 * Allows the authenticated user to:
 * - View their current profile (email, role, UID).
 * - Update their own email address via `PATCH /api/v1/users/me`.
 * - Switch the UI language (persisted in i18next's `localStorage` key).
 */
import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Stack,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/auth-context';
import { updateMyEmail } from '../../services/api';
import { toUserFacingErrorMessage } from '../../services/api-error';
import ErrorMessage from '../../components/ErrorMessage';
import { useToast } from '../../contexts/use-toast';

export default function AccountPage() {
  const { t, i18n } = useTranslation();
  const { userProfile } = useAuth();
  const { showToast } = useToast();
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  const handleUpdateEmail = async () => {
    setEmailLoading(true);
    setEmailError(null);
    setEmailSuccess(null);
    try {
      await updateMyEmail(newEmail);
      const successMessage = t('common.success');
      setEmailSuccess(successMessage);
      showToast(successMessage, { severity: 'success' });
      setNewEmail('');
    } catch (error) {
      const errorMessage = toUserFacingErrorMessage(error, t('common.error'));
      setEmailError(errorMessage);
      showToast(errorMessage, { severity: 'error' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    void i18n.changeLanguage(lang);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 2.5 }}>{t('account.title')}</Typography>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('dashboard.profile')}</Typography>
          <Stack spacing={1.25} sx={{ mt: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="baseline">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 56 }}>Email:</Typography>
              <Typography variant="body1" color="text.primary" sx={{ fontWeight: 600 }}>{userProfile?.email ?? '-'}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="baseline">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 56 }}>{t('dashboard.role')}:</Typography>
              <Typography variant="body1" color="text.primary" sx={{ fontWeight: 600 }}>{userProfile?.role ?? '-'}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="baseline">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 56 }}>UID:</Typography>
              <Typography variant="body1" color="text.primary" sx={{ fontWeight: 600 }}>{userProfile?.uid ?? '-'}</Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('account.updateEmail')}</Typography>
          {emailError && <ErrorMessage message={emailError} onClose={() => setEmailError(null)} />}
          {emailSuccess && <Alert severity="success" onClose={() => setEmailSuccess(null)} sx={{ mb: 2 }}>{emailSuccess}</Alert>}
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <TextField
              label={t('account.newEmail')}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              type="email"
              size="small"
              sx={{ minWidth: 280 }}
            />
            <Button
              variant="contained"
              onClick={() => { void handleUpdateEmail(); }}
              disabled={emailLoading || !newEmail}
              sx={{ px: 2.5 }}
            >
              {t('account.saveChanges')}
            </Button>
          </Box>
        </CardContent>
      </Card>
      <Divider sx={{ my: 3 }} />
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('account.languagePreference')}</Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>{t('account.languagePreference')}</InputLabel>
            <Select
              value={i18n.language}
              label={t('account.languagePreference')}
              onChange={(e) => handleLanguageChange(e.target.value)}
            >
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="pt-BR">Português (BR)</MenuItem>
              <MenuItem value="es">Español</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>
    </Box>
  );
}
