import React from "react";
import { Grid, Avatar, Box } from "@mui/material";
import styled from "@emotion/styled";
import BotAvatar from "../../Assets/BotAvatar.png"; // Adjust the path based on your file structure

export const BlinkingDot = styled(Box)(({ theme }) => ({
  width: "10px",
  height: "10px",
  backgroundColor: "grey", // Using the primary color from the theme
  borderRadius: "50%",
  animation: "blink 1s infinite",

  "@keyframes blink": {
    "0%, 100%": {
      opacity: 1,
    },
    "50%": {
      opacity: 0.2,
    },
  },
}));

const InitialProcessing = ({ message }) => {
  return (
    <Grid container direction="row" justifyContent="flex-start" alignItems="flex-end">
      <Grid item>
        <Avatar alt="Bot Avatar" src={BotAvatar} />
      </Grid>
      {/* <Grid item container direction="column" sx={{ flex: 1 }} spacing={2}> */}
      <BlinkingDot sx={{ ml: 1, mb: 0.5 }} />
      {/* </Grid> */}
    </Grid>
  );
};

export default InitialProcessing;
