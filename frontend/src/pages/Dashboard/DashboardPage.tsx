/**
 * @file DashboardPage.tsx — Home page shown after a successful sign-in.
 *
 * Displays the authenticated user's profile summary (email, role, enabled
 * status) and a feature overview grid that shows which platform features are
 * live and which are coming soon (controlled by {@link useFeatureFlags}).
 */
import type { ReactNode } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Description as DescriptionIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/auth-context';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

/** Props for the {@link FeatureCard} component. */
interface FeatureCardProps {
  title: string;
  icon: ReactNode;
  available: boolean;
  description: string;
}

/**
 * Small summary card used to advertise a platform feature on the dashboard.
 * Renders with reduced opacity and a "coming soon" chip when `available` is
 * `false`.
 */
function FeatureCard({ title, icon, available, description }: FeatureCardProps) {
  const { t } = useTranslation();
  return (
    <Card sx={{ height: '100%', opacity: available ? 1 : 0.7 }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          {icon}
          <Typography variant="h6">{title}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">{description}</Typography>
        {!available && (
          <Chip label={t('dashboard.comingSoon')} size="small" color="default" sx={{ mt: 1 }} />
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const features = useFeatureFlags();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {t('dashboard.welcome')}, {userProfile?.name ?? userProfile?.email ?? ''}!
      </Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <PersonIcon color="primary" />
                <Typography variant="h6">{t('dashboard.yourProfile')}</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2"><strong>Email:</strong> {userProfile?.email}</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}><strong>{t('dashboard.role')}:</strong> {userProfile?.role}</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                <strong>{t('dashboard.status')}:</strong>{' '}
                <Chip
                  label={userProfile?.enable ? t('dashboard.active') : t('dashboard.pending')}
                  color={userProfile?.enable ? 'success' : 'warning'}
                  size="small"
                />
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <AdminIcon color="primary" />
                <Typography variant="h6">{t('dashboard.statistics')}</Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">{t('dashboard.recentActivity')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{t('dashboard.comingSoon')}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <FeatureCard
            title={t('nav.resumes')}
            icon={<DescriptionIcon color="primary" />}
            available={features.resumeIngest || features.resumeGenerate}
            description={t('dashboard.featureNotAvailable')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <FeatureCard
            title={t('nav.search')}
            icon={<SearchIcon color="primary" />}
            available={features.resumeSearch}
            description={t('dashboard.featureNotAvailable')}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
