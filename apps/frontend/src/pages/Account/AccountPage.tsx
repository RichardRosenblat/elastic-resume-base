/**
 * @file AccountPage.tsx — User account settings page.
 *
 * Allows the authenticated user to:
 * - View their current profile (email, role, UID) via {@link DataDisplayTemplate}.
 * - Reset their password by email via Aegis / Firebase.
 * - Switch the UI language (persisted in i18next's `localStorage` key).
 */
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
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/auth-context';
import { useShowApiError } from '../../hooks/useShowApiError';
import { useToast } from '../../contexts/use-toast';
import { DataDisplayTemplate, FormTemplate } from '../../components/templates';

export default function AccountPage() {
  const { t, i18n } = useTranslation();
  const { userProfile, sendPasswordResetEmail } = useAuth();
  const { showToast } = useToast();
  const showApiError = useShowApiError();
  const [resetLoading, setResetLoading] = useState(false);

  const handleSendPasswordReset = async () => {
    const email = userProfile?.email;
    if (!email) return;
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(email);
      showToast(t('account.passwordResetSent'), { severity: 'success' });
    } catch (error) {
      showApiError(error, t('common.error'));
    } finally {
      setResetLoading(false);
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

      <Divider sx={{ my: 3 }} />

      {/* ── Password reset ────────────────────────────────────────────────── */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('account.changePassword')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('account.changePasswordDescription')}
          </Typography>
          <FormTemplate
            config={{
              fields: [],
              buttons: [
                {
                  label: t('account.sendPasswordReset'),
                  onClick: () => { void handleSendPasswordReset(); },
                  variant: 'outlined',
                  disabled: resetLoading || !userProfile?.email,
                  sx: { px: 2.5 },
                },
              ],
              values: {},
              onChange: () => undefined,
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
