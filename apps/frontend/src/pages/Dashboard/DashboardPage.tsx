/**
 * @file DashboardPage.tsx — Home page shown after a successful sign-in.
 *
 * Displays the authenticated user's profile summary (email, role, enabled
 * status) and a feature overview grid that shows which platform features are
 * live and which are coming soon (controlled by {@link useFeatureFlags}).
 *
 * Feature card order follows the `dashboard.items` order from the theme JSON.
 * When no dashboard-specific order is defined, the `sidebar.items` order is
 * used as a fallback.  Both orders can be overridden in `theme.local.json`.
 *
 * Features whose flag is disabled can be hidden entirely by setting
 * `VITE_FEATURE_HIDE_IF_DISABLED=true` in `config.yaml`.
 */
import type { ReactNode } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Person as PersonIcon,
  Description as DescriptionIcon,
  Search as SearchIcon,
  FindInPage as FindInPageIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  HealthAndSafety as HealthAndSafetyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/auth-context';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { useAppTheme } from '../../theme';
import { DataDisplayTemplate, FeatureCardTemplate } from '../../components/templates';

/** A single feature entry in the dashboard feature grid. */
interface DashboardFeatureItem {
  path: string;
  title: string;
  icon: ReactNode;
  available: boolean;
  description: string;
  adminOnly?: boolean;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { userProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const features = useFeatureFlags();
  const { theme } = useAppTheme();

  const featureItems: DashboardFeatureItem[] = [
    {
      path: '/resumes',
      title: t('nav.resumes'),
      icon: <DescriptionIcon color="primary" />,
      available: features.resumeIngest,
      description: t('dashboard.resumesDescription'),
    },
    {
      path: '/search',
      title: t('nav.search'),
      icon: <SearchIcon color="primary" />,
      available: features.resumeSearch || features.resumeGenerate,
      description: t('dashboard.searchDescription'),
    },
    {
      path: '/documents',
      title: t('nav.documents'),
      icon: <FindInPageIcon color="primary" />,
      available: features.documentRead,
      description: t('dashboard.documentsDescription'),
    },
    {
      path: '/system-status',
      title: t('nav.systemStatus'),
      icon: <HealthAndSafetyIcon color="primary" />,
      available: true,
      description: t('dashboard.systemStatusDescription'),
    },
    {
      path: '/users',
      title: t('nav.users'),
      icon: <PeopleIcon color="primary" />,
      available: features.userManagement,
      description: t('dashboard.usersDescription'),
      adminOnly: true,
    },
  ];

  // Determine which order config to use: dashboard-specific override if present,
  // otherwise fall back to the sidebar item order from the theme.
  const orderItems = theme.dashboard?.items ?? theme.sidebar?.items ?? [];
  const orderMap = new Map<string, number>(
    orderItems.map((cfg) => [cfg.path, cfg.order ?? Infinity]),
  );

  const visibleFeatures = featureItems
    .filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      if (features.hideIfDisabled && !item.available) return false;
      return true;
    })
    .sort((a, b) => {
      const orderA = orderMap.get(a.path) ?? Infinity;
      const orderB = orderMap.get(b.path) ?? Infinity;
      return orderA - orderB;
    });

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

        {visibleFeatures.map((item) => (
          <Grid key={item.path} size={{ xs: 12, sm: 6, md: 3 }}>
            <FeatureCardTemplate
              title={item.title}
              icon={item.icon}
              available={item.available}
              description={item.description}
              path={item.path}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
