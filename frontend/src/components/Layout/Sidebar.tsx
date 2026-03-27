/**
 * @file Sidebar.tsx — Navigation drawer component.
 *
 * Renders an MUI `Drawer` with a list of navigation links. Items are
 * filtered based on:
 * - `adminOnly` — hidden for non-admin users.
 * - `featureFlag` — when `false`, the item is shown but disabled with a
 *   "Coming Soon" badge so users can see what is planned.
 *
 * Navigating to a route on a `temporary` variant drawer auto-closes it.
 */
import type { ReactNode } from 'react';
import {
  Box,
  Chip,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Toolbar,
  Tooltip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Search as SearchIcon,
  FindInPage as FindInPageIcon,
  AccountCircle as AccountCircleIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/auth-context';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

const DRAWER_WIDTH = 240;

/** A single navigation entry shown in the sidebar. */
interface NavItem {
  label: string;
  icon: ReactNode;
  path: string;
  adminOnly?: boolean;
  featureFlag?: boolean;
}

/** Props for the {@link Sidebar} component. */
interface SidebarProps {
  open: boolean;
  variant: 'permanent' | 'temporary';
  onClose: () => void;
}

/**
 * Navigation drawer that lists all application routes the current user can
 * access. Supports both `permanent` (desktop) and `temporary` (mobile)
 * MUI drawer variants.
 */
export default function Sidebar({ open, variant, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const features = useFeatureFlags();

  const navItems: NavItem[] = [
    { label: t('nav.dashboard'), icon: <DashboardIcon />, path: '/' },
    { label: t('nav.users'), icon: <PeopleIcon />, path: '/users', adminOnly: true, featureFlag: features.userManagement },
    { label: t('nav.resumes'), icon: <DescriptionIcon />, path: '/resumes', featureFlag: true },
    { label: t('nav.search'), icon: <SearchIcon />, path: '/search', featureFlag: true },
    { label: t('nav.documents'), icon: <FindInPageIcon />, path: '/documents', featureFlag: features.documentRead },
    { label: t('nav.account'), icon: <AccountCircleIcon />, path: '/account' },
  ];

  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const handleNav = (path: string) => {
    void navigate(path);
    if (variant === 'temporary') onClose();
  };

  const drawerContent = (
    <>
      <Toolbar />
      <Divider />
      <List>
        {visibleItems.map((item) => {
          const isDisabled = item.featureFlag === false;
          const button = (
            <ListItemButton
              selected={!isDisabled && location.pathname === item.path}
              onClick={() => handleNav(item.path)}
              disabled={isDisabled}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
              {isDisabled && (
                <Chip label={t('nav.comingSoon')} size="small" sx={{ ml: 1 }} />
              )}
            </ListItemButton>
          );
          return (
            <ListItem key={item.path} disablePadding>
              {isDisabled ? (
                <Tooltip title={t('nav.comingSoon')} placement="right">
                  <Box component="span" sx={{ width: '100%', display: 'block' }}>{button}</Box>
                </Tooltip>
              ) : (
                button
              )}
            </ListItem>
          );
        })}
      </List>
    </>
  );

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
