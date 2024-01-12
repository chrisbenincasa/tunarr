import { createTheme } from '@mui/material/styles';
import { red } from '@mui/material/colors';

const darkMode = false; //TO DO

const theme = createTheme({
  palette: {
    mode: darkMode ? 'dark' : 'light',
    primary: {
      main: red[500],
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          padding: 16,
        },
      },
    },
  },
});

export default theme;
