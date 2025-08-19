import React, { useState } from 'react';
import { Box, Button, Typography, Radio, RadioGroup, FormControlLabel } from '@mui/material';
import AppHeader from './AppHeader';
import ChatHeader from './ChatHeader'; // Import ChatHeader
import { useLanguage } from '../utilities/LanguageContext';
import { useCookies } from 'react-cookie';
import Grid from "@mui/material/Grid";
import { LANDING_PAGE_TEXT } from '../utilities/constants'; // Adjust the import path

const LandingPage = () => {
  const [selectedLanguage, setSelectedLanguage] = useState('EN');
  const { setLanguage } = useLanguage();
  const [, setCookie] = useCookies(['language']);

  const handleLanguageChange = (event) => {
    setSelectedLanguage(event.target.value);
  };

  const handleSaveLanguage = () => {
    setLanguage(selectedLanguage);
    setCookie('language', selectedLanguage, { path: '/' });
    window.location.reload(); // Reload the page to apply the new language setting
  };

  const texts = LANDING_PAGE_TEXT[selectedLanguage];

  return (
    <Box height="100vh" display="flex" flexDirection="column">
      <AppHeader showSwitch={false} />
      <Grid container direction="column" justifyContent="flex-start" alignItems="center" flex={1} p={2}>
        <Box mt={0} mb={4}> {/* Add some margin-top and margin-bottom for spacing */}
          <ChatHeader selectedLanguage={selectedLanguage} />
        </Box>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={12}>
          <Typography variant="h5" gutterBottom>
            {texts.CHOOSE_LANGUAGE}
          </Typography>
          <RadioGroup value={selectedLanguage} onChange={handleLanguageChange}>
            <FormControlLabel value="EN" control={<Radio />} label={texts.ENGLISH} />
            <FormControlLabel value="ES" control={<Radio />} label={texts.SPANISH} />
          </RadioGroup>
          <Button variant="contained" onClick={handleSaveLanguage} sx={{ mt: 2 }}>
            {texts.SAVE_CONTINUE}
          </Button>
        </Box>
      </Grid>
    </Box>
  );
};

export default LandingPage;
