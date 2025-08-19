import React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { useLanguage } from "../utilities/LanguageContext"; // Adjust the import path
import { ABOUT_US_HEADER_BACKGROUND, SHOW_FAQ_LEFT_NAV, ABOUT_US_TEXT, FAQ_HEADER_BACKGROUND, FAQ_TEXT, TEXT } from "../utilities/constants"; // Adjust the import path
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
function LeftNav({ showLeftNav = true, setLeftNav }) {
  const { language } = useLanguage();

  return (
    <>
      <Grid className="appHeight100">
        <Grid container direction="column" justifyContent="flex-start" alignItems="stretch" padding={4} spacing={2}>
          {showLeftNav ? (
            <>
              <Grid item container direction="column" justifyContent="flex-start" alignItems="flex-end">
                <CloseIcon alt="Close Panel" onClick={() => setLeftNav(false)} />
              </Grid>
              <Grid item>
                <Typography variant="h6" sx={{ fontWeight: "bold" }} color={ABOUT_US_HEADER_BACKGROUND}>
                  {TEXT[language].ABOUT_US_TITLE}
                </Typography>
              </Grid>
              <Grid item>
                <Typography variant="subtitle1" color={ABOUT_US_TEXT}>
                  {TEXT[language].ABOUT_US}
                </Typography>
              </Grid>
              {SHOW_FAQ_LEFT_NAV && (
                <Grid item>
                  <Typography variant="h6" sx={{ fontWeight: "bold" }} color={FAQ_HEADER_BACKGROUND}>
                    {TEXT[language].FAQ_TITLE}
                  </Typography>
                </Grid>
              )}
              {SHOW_FAQ_LEFT_NAV && (
                <Grid item>
                  <ul>
                    {TEXT[language].FAQS.map((question, index) => (
                      <li key={index}>
                        <Typography variant="subtitle1" color={FAQ_TEXT}>
                          {question}
                        </Typography>
                      </li>
                    ))}
                  </ul>
                </Grid>
              )}
            </>
          ) : (
            <>
              <Grid item container direction="row" justifyContent="flex-start" alignItems="flex-end">
                <KeyboardArrowRightIcon alt="Open Panel" onClick={() => setLeftNav(true)} />
              </Grid>
            </>
          )}
        </Grid>
      </Grid>
    </>
  );
}

export default LeftNav;
