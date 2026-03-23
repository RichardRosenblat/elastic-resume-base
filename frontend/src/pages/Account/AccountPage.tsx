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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { updateMyEmail } from '../../services/api';
import ErrorMessage from '../../components/ErrorMessage';

export default function AccountPage() {
  const { t, i18n } = useTranslation();
  const { userProfile } = useAuth();
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
      setEmailSuccess(t('common.success'));
      setNewEmail('');
    } catch {
      setEmailError(t('common.error'));
    } finally {
      setEmailLoading(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    void i18n.changeLanguage(lang);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>{t('account.title')}</Typography>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('dashboard.profile')}</Typography>
          <Typography variant="body2"><strong>Email:</strong> {userProfile?.email}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}><strong>{t('dashboard.role')}:</strong> {userProfile?.role}</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}><strong>UID:</strong> {userProfile?.uid}</Typography>
        </CardContent>
      </Card>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('account.updateEmail')}</Typography>
          {emailError && <ErrorMessage message={emailError} onClose={() => setEmailError(null)} />}
          {emailSuccess && <Alert severity="success" onClose={() => setEmailSuccess(null)} sx={{ mb: 2 }}>{emailSuccess}</Alert>}
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-start">
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
