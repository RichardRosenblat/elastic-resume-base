/**
 * @file AppLayout.tsx — Responsive application shell.
 *
 * Composes {@link Topbar} and {@link Sidebar} around a main content area
 * rendered by React Router's `<Outlet />`. Handles the responsive drawer:
 * on small screens (`< sm`) the sidebar is a temporary drawer toggled by
 * the hamburger button in the top bar; on larger screens it is a permanent
 * drawer that always occupies `DRAWER_WIDTH` (or `DRAWER_COLLAPSED_WIDTH`
 * when collapsed) pixels on the left.
 */
import { useState } from 'react';
import { Box, Toolbar, useTheme, useMediaQuery } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import Topbar from './Topbar';
import Sidebar, { DRAWER_WIDTH, DRAWER_COLLAPSED_WIDTH } from './Sidebar';
import SupportFooter from '../SupportFooter';

/**
 * Responsive app shell that renders the top bar, navigation sidebar, and
 * a main content `<Outlet />`. On screens narrower than the `sm` breakpoint
 * the sidebar becomes a togglable temporary drawer.
 */
export default function AppLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const currentDrawerWidth = isMobile
    ? DRAWER_WIDTH
    : sidebarCollapsed
      ? DRAWER_COLLAPSED_WIDTH
      : DRAWER_WIDTH;

  return (
    <Box sx={{ display: 'flex' }}>
      <Topbar onMenuClick={handleDrawerToggle} drawerWidth={currentDrawerWidth} />
      {isMobile ? (
        <Sidebar
          open={mobileOpen}
          variant="temporary"
          onClose={handleDrawerToggle}
        />
      ) : (
        <Sidebar
          open={true}
          variant="permanent"
          onClose={() => {}}
          onCollapsedChange={setSidebarCollapsed}
        />
      )}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${currentDrawerWidth}px)` },
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          transition: 'width 0.2s ease-in-out',
        }}
      >
        <Toolbar />
        <Box
          key={location.pathname}
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            animation: 'pageEnter 0.25s ease-out both',
          }}
        >
          <Outlet />
        </Box>
        <SupportFooter />
      </Box>
    </Box>
  );
}
