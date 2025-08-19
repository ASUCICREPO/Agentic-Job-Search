import React, { useState } from "react";
import theme from "./theme"; // Import your theme
import { ThemeProvider } from "@mui/material/styles"; // Import ThemeProvider
import Grid from "@mui/material/Grid";
import AppHeader from "./Components/AppHeader";
import LeftNav from "./Components/LeftNav";
import ChatHeader from "./Components/ChatHeader";
import ChatBody from "./Components/ChatBody";
import { LanguageProvider } from "./utilities/LanguageContext"; // Adjust the import path
import LandingPage from "./Components/LandingPage";
import { useCookies } from "react-cookie";
import { ALLOW_LANDING_PAGE } from "./utilities/constants";
import { TranscriptProvider } from "./utilities/TranscriptContext";
import { useMediaQuery } from "@mui/material";

function MainApp() {
  const [showLeftNav, setLeftNav] = useState(true);
  const isXs = useMediaQuery(theme.breakpoints.down("sm")); // Detect xs screens
  console.log(isXs);
  return (
    <Grid container direction="column" justifyContent="center" alignItems="stretch" className="appHeight100 appHideScroll">
      <Grid item>
        <AppHeader showSwitch={true} />
      </Grid>
      <Grid item container direction="row" justifyContent="flex-start" alignItems="stretch" className="appFixedHeight100">
        <Grid item display={{ xs: "none", md: "flex" }} xs={showLeftNav ? 3 : 0.5} sx={{ backgroundColor: (theme) => theme.palette.background.chatLeftPanel }}>
          <LeftNav showLeftNav={showLeftNav} setLeftNav={setLeftNav} />
        </Grid>
        <Grid
          container
          item
          xs={isXs ? 12 : showLeftNav ? 9 : 11.5}
          direction="row"
          justifyContent="flex-start"
          alignItems="stretch"
          className="appHeight100"
          sx={{
            padding: { xs: "1.5rem", md: "1.5rem 5%", lg: "1.5rem 10%", xl: "1.5rem 10%" },
            backgroundColor: (theme) => theme.palette.background.chatBody,
          }}
        >
          <Grid item>
            <ChatHeader />
          </Grid>
          <Grid
            container
            item
            direction="row"
            justifyContent={"center"}
            alignItems="flex-end"
            sx={{
              pt: 4,
              height: { xs: "calc(100% - 2.625rem)", md: "calc(100% - 2.625rem)", lg: "calc(100% - 2.625rem)", xl: "calc(100% - 2.625rem)" },
            }}
          >
            <ChatBody />
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
}

function App() {
  const [cookies] = useCookies(["language"]);
  const languageSet = Boolean(cookies.language);

  return (
    <LanguageProvider>
      <TranscriptProvider>
        <ThemeProvider theme={theme}>{!languageSet && ALLOW_LANDING_PAGE ? <LandingPage /> : <MainApp />}</ThemeProvider>
      </TranscriptProvider>
    </LanguageProvider>
  );
}

export default App;
