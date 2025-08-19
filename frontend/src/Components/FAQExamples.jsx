import React, { useState, useEffect } from "react";
import { TEXT } from "../utilities/constants";
import { useLanguage } from "../utilities/LanguageContext"; // Adjust the import path
import { Box, Grid } from "@mui/material";

const shuffleArray = (array) => {
  return array.sort(() => Math.random() - 0.5);
};

const FAQExamples = ({ onPromptClick }) => {
  const { language } = useLanguage();
  const [faqs, setFaqs] = useState([]);

  useEffect(() => {
    // Shuffle FAQs on initial render
    const shuffledFAQs = shuffleArray([...TEXT[language].FAQS]).slice(0, 4);
    setFaqs(shuffledFAQs);
  }, [language]);

  return (
    <Box display="flex" justifyContent="center" alignItems="end" minHeight="71vh">
      <Grid container spacing={1}>
        {faqs.map((prompt, index) => (
          <Grid item key={index} xs={3} onClick={() => onPromptClick(prompt)}>
            <Grid
              alignItems={"center"}
              sx={{
                background: (theme) => theme.palette.background.userMessage,
                width: "100%",
                color: (theme) => theme.palette.getContrastText(theme.palette.background.userMessage),
                minHeight: "7rem",
                textAlign: "left",
                textTransform: "none", // Prevent text from being uppercase
                padding: 1,
                fontSize: 14,
                borderRadius: 2,
                fontWeight: 500,
              }}
            >
              {prompt}
            </Grid>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default FAQExamples;
