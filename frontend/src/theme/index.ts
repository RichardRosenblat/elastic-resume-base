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
