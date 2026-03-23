/**
 * @file theme/index.ts — MUI theme factory.
 *
 * Creates the application-wide MUI theme by reading the primary and
 * secondary brand colours from the runtime configuration (sourced from
 * `VITE_PRIMARY_COLOR` and `VITE_SECONDARY_COLOR`). Importing this module
 * in multiple places always returns the same singleton object because
 * module-level constants are evaluated once.
 *
 * @example
 * import { theme } from './theme';
 * <ThemeProvider theme={theme}>…</ThemeProvider>
 */
import { createTheme } from '@mui/material/styles';
import { config } from '../config';

export const theme = createTheme({
  palette: {
    primary: { main: config.primaryColor },
    secondary: { main: config.secondaryColor },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});
