import type { ReactNode } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Toolbar,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Description as DescriptionIcon,
  Search as SearchIcon,
  AccountCircle as AccountCircleIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

const DRAWER_WIDTH = 240;

interface NavItem {
  label: string;
  icon: ReactNode;
  path: string;
  adminOnly?: boolean;
  featureFlag?: boolean;
}

interface SidebarProps {
  open: boolean;
  variant: 'permanent' | 'temporary';
  onClose: () => void;
}

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
        {visibleItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNav(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
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
