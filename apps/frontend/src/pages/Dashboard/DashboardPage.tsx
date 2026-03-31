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
  CardActionArea,
  CardContent,
  Typography,
  Chip,
  Tooltip,
  IconButton,
} from '@mui/material';import {
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Description as DescriptionIcon,
  Search as SearchIcon,
  FindInPage as FindInPageIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/auth-context';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { DataDisplayTemplate } from '../../components/templates';

/** Props for the {@link FeatureCard} component. */
interface FeatureCardProps {
  title: string;
  icon: ReactNode;
  available: boolean;
  description: string;
  path?: string;
}

/**
 * Small summary card used to advertise a platform feature on the dashboard.
 * Renders with reduced opacity and a "coming soon" chip when `available` is
 * `false`. When a `path` is provided the card is clickable and navigates to
 * that route on click.
 */
function FeatureCard({ title, icon, available, description, path }: FeatureCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const content = (
    <CardContent>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        {icon}
        <Typography variant="h6">{title}</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">{description}</Typography>
      {!available && (
        <Chip label={t('dashboard.comingSoon')} size="small" color="default" variant="outlined" sx={{ mt: 1.5 }} />
      )}
    </CardContent>
  );

  return (
    <Card sx={{ height: '100%', opacity: available ? 1 : 0.82 }}>
      {path ? (
        <CardActionArea
          sx={{ height: '100%' }}
          onClick={() => { void navigate(path); }}
        >
          {content}
        </CardActionArea>
      ) : content}
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const features = useFeatureFlags();

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 2.5 }}>
        {t('dashboard.welcome')}, {userProfile?.name ?? userProfile?.email?.split('@')[0] ?? ''}!
      </Typography>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <PersonIcon color="primary" />
                <Typography variant="h6" sx={{ flexGrow: 1 }}>{t('dashboard.yourProfile')}</Typography>
                <Tooltip title={t('dashboard.editProfile')}>
                  <IconButton
                    size="small"
                    onClick={() => { void navigate('/account'); }}
                    aria-label={t('dashboard.editProfile')}
                  >
                    <SettingsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <DataDisplayTemplate
                config={{
                  fields: [
                    {
                      key: 'email',
                      label: t('users.email'),
                      render: (val) => (
                        <Typography variant="body1" color="text.primary" sx={{ fontWeight: 600 }}>
                          {(val as string) ?? '-'}
                        </Typography>
                      ),
                    },
                    { key: 'role', label: t('dashboard.role') },
                    {
                      key: 'status',
                      label: t('dashboard.status'),
                      render: (val) => (
                        <Chip
                          label={val === 'active' ? t('dashboard.active') : t('dashboard.pending')}
                          color={val === 'active' ? 'success' : 'warning'}
                          size="small"
                        />
                      ),
                    },
                  ],
                  data: {
                    email: userProfile?.email ?? '-',
                    role: userProfile?.role ?? '-',
                    status: userProfile?.enable ? 'active' : 'pending',
                  },
                }}
              />
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
              <Typography variant="body2" color="text.secondary">{t('dashboard.recentActivity')}</Typography>
              <Chip
                label={t('dashboard.comingSoon')}
                size="small"
                color="default"
                variant="outlined"
                sx={{ mt: 1.5 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <FeatureCard
            title={t('nav.resumes')}
            icon={<DescriptionIcon color="primary" />}
            available={features.resumeIngest || features.resumeGenerate}
            description={t('dashboard.featureNotAvailable')}
            path="/resumes"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <FeatureCard
            title={t('nav.search')}
            icon={<SearchIcon color="primary" />}
            available={features.resumeSearch}
            description={t('dashboard.featureNotAvailable')}
            path="/search"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <FeatureCard
            title={t('nav.documents')}
            icon={<FindInPageIcon color="primary" />}
            available={features.documentRead}
            description={t('documents.uploadDescription')}
            path="/documents"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
