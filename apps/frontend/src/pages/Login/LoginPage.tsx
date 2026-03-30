/**
 * @file LoginPage.tsx — Public sign-in page.
 *
 * Supports two authentication methods:
 * 1. Email + password via Firebase Auth (`signInWithEmailAndPassword`).
 * 2. Google OAuth popup (`signInWithPopup`).
 *
 * Form validation is handled by `react-hook-form` with a `zod` schema.
 * If the user is already authenticated, they are redirected to `/`.
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Container,
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/auth-context';
import ErrorMessage from '../../components/ErrorMessage';
import { useAppTheme } from '../../theme';
import SupportFooter from '../../components/SupportFooter';
import { useButtonLock } from '../../hooks/useButtonLock';
import LoadingSpinner from '../../components/LoadingSpinner';

const loginSchema = z.object({
  email: z.email().min(1),
  password: z.string().min(1),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, loginWithGoogle, currentUser, userProfile, loading } = useAuth();
  const { theme } = useAppTheme();
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { locked: googleLocked, wrap: wrapGoogle } = useButtonLock();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Show a full-page spinner while the initial auth check or profile fetch is in progress.
  // This prevents the login form from flashing before we know whether the user is authenticated.
  if (loading) {
    return <LoadingSpinner />;
  }

  // Once loading is complete, redirect authenticated users with a valid profile to the dashboard.
  // We require `userProfile` (not just `currentUser`) so that users who are still in Firebase
  // but lack application access (403 FORBIDDEN) are never forwarded to protected routes.
  if (currentUser && userProfile) {
    return <Navigate to={theme.sidebar?.mainScreen ?? '/'} replace />;
  }

  const onSubmit = async (data: LoginFormData) => {
    setError(null);
    try {
      await login(data.email, data.password);
      // Do NOT navigate here. AuthContext.onAuthStateChanged will fetch the user profile
      // and set `loading=true` while that happens. Once loading finishes, the guard above
      // (`currentUser && userProfile`) triggers navigation on a successful profile fetch.
      // If the profile fetch fails with 403, AuthContext signs the user out and shows a
      // toast so they remain on this page.
    } catch {
      setError(t('auth.invalidCredentials'));
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      // Do NOT navigate here — same reasoning as onSubmit above.
    } catch {
      setError(t('auth.loginError'));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
      >
        <Card sx={{ width: '100%', maxWidth: 440, marginTop: 5 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" textAlign="center" gutterBottom>
              {theme.branding.appName}
            </Typography>
            <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mb: 1 }}>
              {theme.branding.companyName}
            </Typography>
            <Typography variant="h6" textAlign="center" color="text.secondary" gutterBottom>
              {t('auth.welcomeBack')}
            </Typography>
            {error && (
              <ErrorMessage message={error} onClose={() => setError(null)} />
            )}
            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ mt: 2 }}>
              <TextField
                {...register('email')}
                label={t('auth.email')}
                type="email"
                fullWidth
                margin="normal"
                error={!!errors.email}
                helperText={errors.email?.message}
                autoComplete="email"
              />
              <TextField
                {...register('password')}
                label={t('auth.password')}
                type="password"
                fullWidth
                margin="normal"
                error={!!errors.password}
                helperText={errors.password?.message}
                autoComplete="current-password"
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isSubmitting}
                sx={{ mt: 2 }}
              >
                {isSubmitting ? <CircularProgress size={24} /> : t('auth.signIn')}
              </Button>
            </Box>
            <Divider sx={{ my: 3 }}>{t('common.or')}</Divider>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              startIcon={googleLoading ? <CircularProgress size={20} /> : <GoogleIcon />}
              onClick={wrapGoogle(handleGoogleLogin)}
              disabled={googleLoading || googleLocked}
            >
              {t('auth.signInWithGoogle')}
            </Button>
          </CardContent>
        </Card>
        <SupportFooter />
      </Box>
    </Container>
  );
}
