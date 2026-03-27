/**
 * @file AppLayout.tsx — Responsive application shell.
 *
 * Composes {@link Topbar} and {@link Sidebar} around a main content area
 * rendered by React Router's `<Outlet />`. Handles the responsive drawer:
 * on small screens (`< sm`) the sidebar is a temporary drawer toggled by
 * the hamburger button in the top bar; on larger screens it is a permanent
 * drawer that always occupies `DRAWER_WIDTH` pixels on the left.
 */
import { useState } from 'react';
import { Box, Toolbar, useTheme, useMediaQuery } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import Topbar from './Topbar';
import Sidebar from './Sidebar';
import SupportFooter from '../SupportFooter';

const DRAWER_WIDTH = 240;

/**
 * Responsive app shell that renders the top bar, navigation sidebar, and
 * a main content `<Outlet />`. On screens narrower than the `sm` breakpoint
 * the sidebar becomes a togglable temporary drawer.
 */
export default function AppLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Topbar onMenuClick={handleDrawerToggle} drawerWidth={DRAWER_WIDTH} />
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
        />
      )}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
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
