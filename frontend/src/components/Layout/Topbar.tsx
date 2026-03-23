/**
 * @file Topbar.tsx — Fixed application bar.
 *
 * Displays the app name / logo, a language cycle button, and a user avatar
 * that opens a profile menu with links to the account page and a sign-out
 * action. On small screens it also renders a hamburger icon that calls
 * `onMenuClick` to toggle the sidebar drawer.
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
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle as AccountCircleIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { config } from '../../config';

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
        {config.logoUrl ? (
          <Box component="img" src={config.logoUrl} alt={config.appName} sx={{ height: 32, mr: 1 }} />
        ) : (
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            {config.appName}
          </Typography>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button color="inherit" onClick={cycleLanguage} size="small" sx={{ mr: 1 }}>
          {LANGUAGE_LABELS[i18n.language] ?? 'EN'}
        </Button>
        <IconButton color="inherit" onClick={handleMenuOpen}>
          {photoURL ? (
            <Avatar src={photoURL} sx={{ width: 32, height: 32 }} />
          ) : (
            <AccountCircleIcon />
          )}
        </IconButton>
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
