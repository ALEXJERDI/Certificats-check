// src/theme.ts
import { createTheme } from '@mui/material/styles';

const attijariTheme = createTheme({
  palette: {
    primary: {
      main: '#f5a623', // Orange attijari
      contrastText: '#fff',
    },
    secondary: {
      main: '#2b2b2b', // Gris sombre
    },
    background: {
      default: '#fef8f0', // Fond clair doux
      paper: '#ffffff',
    },
    success: {
      main: '#4caf50',
    },
    error: {
      main: '#e53935',
    },
    warning: {
      main: '#fbc02d',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
    h4: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          padding: '8px 20px',
          fontWeight: 600,
        },
      },
    },
  },
});

export default attijariTheme;
