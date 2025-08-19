import React from "react";
import { Grid, AppBar, Typography } from "@mui/material";
import Logo from "../Assets/header_logo.png";
import Switch from "./Switch.jsx";
import { ALLOW_MULTLINGUAL_TOGGLE, TEXT } from "../utilities/constants";
import { useCookies } from "react-cookie";

function AppHeader({ showSwitch }) {
  const [cookies] = useCookies(["language"]);
  const currentLanguage = cookies.language || "EN";
  const appName = TEXT[currentLanguage]?.APP_NAME || TEXT.EN.APP_NAME;

  return (
    <AppBar
      position="static"
      sx={{
        backgroundColor: (theme) => theme.palette.background.header,
        height: "5rem",
        boxShadow: "none",
        borderBottom: (theme) => `1.5px solid ${theme.palette.primary[50]}`,
      }}
    >
      <Grid container direction="row" justifyContent="space-between" alignItems="center" sx={{ padding: "0 3rem" }} className="appHeight100">
        <Grid item container alignItems={"center"}>
          <img src={Logo} alt={`App main Logo`} height={64} />
          <Typography sx={{ color: (theme) => theme.palette.getContrastText(theme.palette.background.header), fontSize: 16, width: "15rem", ml: 2, fontWeight: 600 }}>{appName}</Typography>
        </Grid>
        <Grid item>
          <Grid container alignItems="center" justifyContent="space-evenly" spacing={2}>
            <Grid item sx={{ display: ALLOW_MULTLINGUAL_TOGGLE && showSwitch ? "flex" : "none" }}>
              <Switch />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </AppBar>
  );
}

export default AppHeader;
