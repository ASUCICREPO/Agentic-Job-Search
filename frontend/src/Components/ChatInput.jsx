import React, { useState, useEffect } from "react";
import { TextField, Grid, IconButton } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { useLanguage } from "../utilities/LanguageContext";
import { TEXT } from "../utilities/constants";
import { useTranscript } from "../utilities/TranscriptContext";

function ChatInput({ onSendMessage, processing, message, setMessage }) {
  const [helperText, setHelperText] = useState("");
  const { language } = useLanguage();
  const { transcript, setTranscript, isListening } = useTranscript();

  useEffect(() => {
    if (!isListening && transcript) {
      setMessage((prevMessage) => (prevMessage ? `${prevMessage} ${transcript}` : transcript));
      setTranscript(""); // Clear the transcript buffer
    }
  }, [isListening, transcript, setTranscript]);

  const handleTyping = (event) => {
    if (helperText) {
      setHelperText("");
    }
    setMessage(event.target.value);
  };

  const handleSendMessage = () => {
    if (message.trim() !== "") {
      onSendMessage(message);
      setMessage("");
    } else {
      setHelperText(TEXT[language].HELPER_TEXT);
    }
  };

  const getMessage = (message, transcript, isListening) => {
    if (isListening) {
      if (transcript.length) {
        return message.length ? `${message} ${transcript}` : transcript;
      }
    }
    return message;
  };

  return (
    <Grid container item xs={12} alignItems="center" className="sendMessageContainer" sx={{ background: (theme) => theme.palette.background.chatLeftPanel }}>
      <Grid item xs={11.5}>
        <TextField
          multiline
          maxRows={4}
          fullWidth
          disabled={isListening}
          placeholder={TEXT[language].CHAT_INPUT_PLACEHOLDER}
          id="USERCHATINPUT"
          value={getMessage(message, transcript, isListening)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !processing) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          onChange={handleTyping}
          helperText={isListening ? TEXT[language].SPEECH_RECOGNITION_HELPER_TEXT : helperText}
          sx={{ "& fieldset": { border: "none" } }}
        />
      </Grid>
      <Grid item xs={0.5}>
        <IconButton aria-label="send" disabled={processing || isListening} onClick={handleSendMessage} color={message.trim() !== "" ? "primary" : "default"}>
          <SendIcon />
        </IconButton>
      </Grid>
    </Grid>
  );
}

export default ChatInput;
