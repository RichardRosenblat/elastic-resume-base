/**
 * @file Sidebar.tsx — Navigation drawer component.
 *
 * Renders an MUI `Drawer` with a list of navigation links. Items are
 * filtered based on:
 * - `adminOnly` — hidden for non-admin users.
 * - `featureFlag` — when `false`, the item is shown but disabled with a
 *   "Coming Soon" tooltip so users can see what is planned.
 *
 * The sidebar supports:
 * - **Collapsible mode** — a toggle button at the bottom collapses the
 *   drawer to show only icons, or expands it to show icons + labels.
 * - **Light / dark mode toggle** — a button at the bottom of the sidebar
 *   switches between the two colour modes using {@link useAppTheme}.
 * - **Theme-driven order** — the `sidebar` section of `theme.json`
 *   (or `theme.local.json`) controls item order and which route is the
 *   main / home screen.  Visibility and access control are managed
 *   exclusively in the component definition (see `navItems`).
 *
 * Navigating to a route on a `temporary` variant drawer auto-closes it.
 */
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Toolbar,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Search as SearchIcon,
  FindInPage as FindInPageIcon,
  AccountCircle as AccountCircleIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/auth-context';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { useAppTheme } from '../../theme';
import type { SidebarItemConfig } from '../../theme';

export const DRAWER_WIDTH = 240;
export const DRAWER_COLLAPSED_WIDTH = 64;

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
  /** Callback fired when the collapsed state changes (desktop only). */
  onCollapsedChange?: (collapsed: boolean) => void;
}

/**
 * Navigation drawer that lists all application routes the current user can
 * access. Supports both `permanent` (desktop) and `temporary` (mobile)
 * MUI drawer variants, collapsing, and light/dark mode toggling.
 *
 * The optional `onCollapsedChange` callback is called whenever the
 * collapsed state changes so that parent layouts (e.g. `AppLayout`) can
 * adjust the main content area width accordingly.
 */
export default function Sidebar({ open, variant, onClose, onCollapsedChange }: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const features = useFeatureFlags();
  const { mode, toggleTheme, theme } = useAppTheme();
  const sidebarConfig = theme.sidebar;

  const [collapsed, setCollapsed] = useState<boolean>(
    sidebarConfig?.defaultCollapsed ?? false,
  );

  // Notify parent on mount so AppLayout can sync its width calculation.
  useEffect(() => {
    if (sidebarConfig?.defaultCollapsed) {
      onCollapsedChange?.(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    onCollapsedChange?.(next);
  };

  const navItems: NavItem[] = [
    { label: t('nav.dashboard'), icon: <DashboardIcon />, path: '/' },
    { label: t('nav.users'), icon: <PeopleIcon />, path: '/users', adminOnly: true, featureFlag: features.userManagement },
    { label: t('nav.systemStatus'), icon: <HealthAndSafetyIcon />, path: '/system-status', adminOnly: true },
    { label: t('nav.resumes'), icon: <DescriptionIcon />, path: '/resumes', featureFlag: features.resumeIngest },
    { label: t('nav.search'), icon: <SearchIcon />, path: '/search', featureFlag: features.resumeSearch || features.resumeGenerate },
    { label: t('nav.documents'), icon: <FindInPageIcon />, path: '/documents', featureFlag: features.documentRead },
    { label: t('nav.account'), icon: <AccountCircleIcon />, path: '/account' },
  ];

  // Build a lookup map for theme-driven per-item config.
  const itemConfigMap = new Map<string, SidebarItemConfig>(
    (sidebarConfig?.items ?? []).map((cfg) => [cfg.path, cfg]),
  );

  // Merge theme config into each nav item and apply visibility rules.
  const visibleItems = navItems
    .filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      if (features.hideIfDisabled && item.featureFlag === false) return false;
      return true;
    })
    .sort((a, b) => {
      const cfgA = itemConfigMap.get(a.path);
      const cfgB = itemConfigMap.get(b.path);
      const orderA = cfgA?.order ?? Infinity;
      const orderB = cfgB?.order ?? Infinity;
      return orderA - orderB;
    });

  const handleNav = (path: string) => {
    void navigate(path);
    if (variant === 'temporary') onClose();
  };

  const currentWidth = variant === 'permanent' && collapsed ? DRAWER_COLLAPSED_WIDTH : DRAWER_WIDTH;

  const themeToggleLabel = mode === 'light' ? t('nav.darkMode') : t('nav.lightMode');
  const collapseToggleLabel = collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar');

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar />
      <Divider />
      <List sx={{ flexGrow: 1, pt: 1 }}>
        {visibleItems.map((item) => {
          const isDisabled = item.featureFlag === false;
          const button = (
            <ListItemButton
              selected={!isDisabled && location.pathname === item.path}
              onClick={() => handleNav(item.path)}
              disabled={isDisabled}
              sx={{
                justifyContent: collapsed ? 'center' : 'flex-start',
                px: collapsed ? 1.5 : 2,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? 'unset' : 40,
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!collapsed && <ListItemText primary={item.label} />}
            </ListItemButton>
          );

          const wrappedButton = isDisabled ? (
            <Tooltip title={t('nav.comingSoon')} placement="right">
              <Box component="span" sx={{ width: '100%', display: 'block' }}>{button}</Box>
            </Tooltip>
          ) : collapsed ? (
            <Tooltip title={item.label} placement="right">
              <Box component="span" sx={{ width: '100%', display: 'block' }}>{button}</Box>
            </Tooltip>
          ) : (
            button
          );

          return (
            <ListItem key={item.path} disablePadding>
              {wrappedButton}
            </ListItem>
          );
        })}
      </List>

      {/* Bottom actions: light/dark toggle + collapse toggle */}
      <Divider />
      <Box
        sx={{
          display: 'flex',
          flexDirection: collapsed ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          p: 1,
          gap: 0.5,
        }}
      >
        <Tooltip title={themeToggleLabel} placement="right">
          <IconButton onClick={toggleTheme} size="small" aria-label={themeToggleLabel}>
            {mode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        {variant === 'permanent' && (
          <Tooltip title={collapseToggleLabel} placement="right">
            <IconButton onClick={handleCollapse} size="small" aria-label={collapseToggleLabel}>
              {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width: currentWidth,
        flexShrink: 0,
        transition: 'width 0.2s ease-in-out',
        '& .MuiDrawer-paper': {
          width: currentWidth,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: 'width 0.2s ease-in-out',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
