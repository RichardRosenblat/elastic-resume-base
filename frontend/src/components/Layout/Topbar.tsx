/**
 * @file Topbar.tsx — Fixed application bar.
 *
 * Displays the app name / logo, a language cycle button, and a user avatar
 * that opens a profile menu with links to the account page and a sign-out
 * action. On small screens it also renders a
 * hamburger icon that calls `onMenuClick` to toggle the sidebar drawer.
 *
 * Branding (app logo + partner logo) is read from the theme system via
 * {@link useAppTheme} instead of environment variables.
 */
import { useState } from 'react';
import type { MouseEvent } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Box,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle as AccountCircleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/auth-context';
import { useAppTheme } from '../../theme';

/** Props for the {@link Topbar} component. */
interface TopbarProps {
  onMenuClick: () => void;
  drawerWidth: number;
}

/**
 * Fixed MUI `AppBar` containing the brand logo/name, language switcher,
 * and authenticated user menu.
 */
export default function Topbar({ onMenuClick, drawerWidth }: TopbarProps) {
  const { t, i18n } = useTranslation();
  const { currentUser, userProfile, logout } = useAuth();
  const { theme } = useAppTheme();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    void logout();
    void navigate('/login');
  };

  const handleProfile = () => {
    handleMenuClose();
    void navigate('/account');
  };

  const LANGUAGES = ['en', 'pt-BR', 'es'] as const;
  const LANGUAGE_LABELS: Record<string, string> = { en: 'EN', 'pt-BR': 'PT', es: 'ES' };

  const cycleLanguage = () => {
    const currentIndex = LANGUAGES.indexOf(i18n.language as typeof LANGUAGES[number]);
    const nextIndex = (currentIndex + 1) % LANGUAGES.length;
    void i18n.changeLanguage(LANGUAGES[nextIndex]);
  };

  const displayName = userProfile?.name ?? currentUser?.email ?? '';
  const photoURL = userProfile?.picture ?? '';
  const { appName, companyName, logoUrl, companyLogo } = theme.branding;

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { sm: `calc(100% - ${drawerWidth}px)` },
        ml: { sm: `${drawerWidth}px` },
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          {logoUrl && (
            <Box component="img" src={logoUrl} alt={appName} sx={{ height: 32, width: 32, borderRadius: 1 }} />
          )}
          <Typography variant="h6" noWrap sx={{ maxWidth: { xs: 120, sm: 180 } }}>
            {appName}
          </Typography>
          <Box
            sx={{
              mx: 0.5,
              width: 1,
              height: 24,
              borderLeft: (muiTheme) => `1px solid ${muiTheme.palette.divider}`,
              display: { xs: 'none', sm: 'block' },
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {companyLogo && (
              <Box
                component="img"
                src={companyLogo}
                alt={companyName || 'Partner logo'}
                sx={{ height: 26, maxWidth: 92, objectFit: 'contain', display: { xs: 'none', md: 'block' } }}
              />
            )}
            <Typography variant="caption" noWrap color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {companyName}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button color="inherit" onClick={cycleLanguage} size="small">
            {LANGUAGE_LABELS[i18n.language] ?? 'EN'}
          </Button>
          <Tooltip title={displayName || t('nav.account')}>
            <IconButton color="inherit" onClick={handleMenuOpen}>
              {photoURL ? (
                <Avatar src={photoURL} sx={{ width: 32, height: 32 }} />
              ) : (
                <AccountCircleIcon />
              )}
            </IconButton>
          </Tooltip>
        </Box>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <MenuItem disabled>
            <Typography variant="body2">{displayName}</Typography>
          </MenuItem>
          <MenuItem onClick={handleProfile}>{t('nav.account')}</MenuItem>
          <MenuItem onClick={handleLogout}>{t('nav.logout')}</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
