import React, { createContext, useState, useContext } from 'react';

const TranscriptContext = createContext();

export const useTranscript = () => useContext(TranscriptContext);

export const TranscriptProvider = ({ children }) => {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);

  return (
    <TranscriptContext.Provider value={{ transcript, setTranscript, isListening, setIsListening }}>
      {children}
    </TranscriptContext.Provider>
  );
};
