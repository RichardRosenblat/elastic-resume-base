/**
 * @file AccountPage.tsx — User account settings page.
 *
 * Allows the authenticated user to:
 * - View their current profile (email, role, UID) via {@link DataDisplayTemplate}.
 * - Update their own email address via `PATCH /api/v1/users/me` using
 *   {@link FormTemplate}.
 * - Switch the UI language (persisted in i18next's `localStorage` key).
 */
import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/auth-context';
import { updateMyEmail } from '../../services/api';
import { toUserFacingErrorMessage } from '../../services/api-error';
import ErrorMessage from '../../components/ErrorMessage';
import { useToast } from '../../contexts/use-toast';
import { DataDisplayTemplate, FormTemplate } from '../../components/templates';

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

      {/* ── Profile display ────────────────────────────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <DataDisplayTemplate
            config={{
              title: t('dashboard.profile'),
              fields: [
                { key: 'email', label: 'Email' },
                { key: 'role', label: t('dashboard.role') },
                { key: 'uid', label: 'UID' },
              ],
              data: {
                email: userProfile?.email ?? '-',
                role: userProfile?.role ?? '-',
                uid: userProfile?.uid ?? '-',
              },
            }}
          />
        </CardContent>
      </Card>

      {/* ── Update email form ─────────────────────────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('account.updateEmail')}</Typography>
          {emailError && <ErrorMessage message={emailError} onClose={() => setEmailError(null)} />}
          {emailSuccess && (
            <Alert severity="success" onClose={() => setEmailSuccess(null)} sx={{ mb: 2 }}>
              {emailSuccess}
            </Alert>
          )}
          <FormTemplate
            config={{
              fields: [
                {
                  key: 'email',
                  label: t('account.newEmail'),
                  type: 'email',
                  size: 'small',
                  minWidth: 280,
                },
              ],
              buttons: [
                {
                  label: t('account.saveChanges'),
                  onClick: () => { void handleUpdateEmail(); },
                  variant: 'contained',
                  disabled: emailLoading || !newEmail,
                  sx: { px: 2.5 },
                },
              ],
              values: { email: newEmail },
              onChange: (_, value) => setNewEmail(value),
            }}
          />
        </CardContent>
      </Card>

      <Divider sx={{ my: 3 }} />

      {/* ── Language preference ───────────────────────────────────────────── */}
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
