import React from 'react';
import { useLanguage } from '../utilities/LanguageContext'; // Adjust the import path
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import { Box } from '@mui/material';
import { SWITCH_TEXT } from '../utilities/constants';
import { useCookies } from 'react-cookie';

export default function Switch() {
  const { language, setLanguage } = useLanguage();
  const [, setCookie] = useCookies(['language']);

  const handleLanguageChange = (newLanguage) => {
    if (newLanguage !== language) {
      setLanguage(newLanguage);
      setCookie('language', newLanguage, { path: '/' });
      window.location.reload(); // Refresh the page to apply the new language setting
    }
  };

  return (
    <Box>
      <ButtonGroup variant="contained" aria-label="Language button group">
        <Tooltip title={SWITCH_TEXT.SWITCH_TOOLTIP_ENGLISH} arrow>
          <Button
            onClick={(e) => {
              e.preventDefault();
              handleLanguageChange('EN');
            }}
            variant={language === 'EN' ? 'contained' : 'outlined'}
          >
            {SWITCH_TEXT.SWITCH_LANGUAGE_ENGLISH}
          </Button>
        </Tooltip>
        <Tooltip title={SWITCH_TEXT.SWITCH_TOOLTIP_SPANISH} arrow>
          <Button
            onClick={(e) => {
              e.preventDefault();
              handleLanguageChange('ES');
            }}
            variant={language === 'ES' ? 'contained' : 'outlined'}
          >
            {SWITCH_TEXT.SWITCH_LANGUAGE_SPANISH}
          </Button>
        </Tooltip>
      </ButtonGroup>
    </Box>
  );
}
