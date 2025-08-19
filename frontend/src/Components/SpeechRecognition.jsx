import React, { useEffect, useRef } from "react";
import IconButton from '@mui/material/IconButton';
import MicIcon from '@mui/icons-material/Mic';
import { styled, keyframes } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import { useLanguage } from '../utilities/LanguageContext';
import { TEXT } from '../utilities/constants';
import { useTranscript } from '../utilities/TranscriptContext';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const pulse = keyframes`
  0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(231, 176, 12, 0.4); }
  70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(231, 176, 12, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(231, 176, 12, 0); }
`;

const MicButton = styled(IconButton)(({ theme, listening }) => ({
  borderRadius: '50%',
  marginLeft: '8px',
  padding: '0.5rem',
  height: '3.5rem',
  width: '3.5rem',
  minWidth: '0',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'transparent',
  '&:hover': { backgroundColor: theme.palette.grey[200] },
  '& .MuiSvgIcon-root': {
    animation: listening ? `${pulse} 1.5s infinite` : 'none',
    color: listening ? theme.palette.primary[50] : theme.palette.primary.main ,
  },
}));

function SpeechRecognitionComponent() {
  const { language } = useLanguage();
  const { setTranscript, isListening, setIsListening } = useTranscript();
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!SpeechRecognition) {
      console.error("SpeechRecognition API not supported in this browser.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    const recognition = recognitionRef.current;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'ES' ? 'es-ES' : 'en-US';

    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };

    recognition.onerror = (event) => {
      console.error("Error occurred in recognition: " + event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log("Recognition ended");
      setIsListening(false);
    };

    return () => {
      recognition.stop();
    };
  }, [language, setTranscript, setIsListening]);

  const toggleListen = () => {
    const recognition = recognitionRef.current;

    if (!recognition) {
      return;
    }

    if (isListening) {
      recognition.stop();
      console.log("Recognition stopped");
    } else {
      recognition.start();
      console.log("Recognition started");
    }
    setIsListening(!isListening);
  };

  return (
    <Tooltip title={isListening ? TEXT[language].SPEECH_RECOGNITION_STOP : TEXT[language].SPEECH_RECOGNITION_START}>
      <MicButton listening={isListening ? 1 : 0} onClick={toggleListen}>
        <MicIcon />
      </MicButton>
    </Tooltip>
  );
}

export default SpeechRecognitionComponent;
