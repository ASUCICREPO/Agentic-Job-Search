import { createTheme } from "@mui/material/styles";
import { PRIMARY_MAIN, SECONDARY_MAIN, CHAT_BODY_BACKGROUND, CHAT_LEFT_PANEL_BACKGROUND, HEADER_BACKGROUND, USERMESSAGE_BACKGROUND, BOTMESSAGE_BACKGROUND, primary_50 } from "./utilities/constants";
import Roboto from "./Assets/Font/Roboto.ttf";

const theme = createTheme({
  typography: {
    fontFamily: "'Roboto', sans-serif",
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @font-face {
          font-family: 'Roboto';
          font-style: normal;
          font-display: swap;
          font-weight: 400;
          src: local('Roboto'), url(${Roboto}) format('truetype');
        }
        body {
          font-family: 'Roboto', sans-serif;
          margin: 0;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          height: 100%;
        }
        html, body {
          height: 100%;
        }
        code {
          font-family: 'Roboto', source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace;
        }
      `,
    },
  },
  palette: {
    primary: {
      main: PRIMARY_MAIN,
      50: primary_50,
    },
    secondary: {
      main: SECONDARY_MAIN,
    },
    background: {
      default: CHAT_BODY_BACKGROUND,
      chatBody: CHAT_BODY_BACKGROUND,
      chatLeftPanel: CHAT_LEFT_PANEL_BACKGROUND,
      header: HEADER_BACKGROUND,
      botMessage: BOTMESSAGE_BACKGROUND,
      userMessage: USERMESSAGE_BACKGROUND,
    },
  },
});

export default theme;
