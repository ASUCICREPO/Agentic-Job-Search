import React, { createContext, useContext, useState, useEffect } from 'react';
import { useCookies } from 'react-cookie';
import { ALLOW_LANDING_PAGE } from './constants';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [cookies, setCookie] = useCookies(['language']);
  //const defaultLanguage = cookies.language || (!ALLOW_LANDING_PAGE ? 'EN' : '');
  const defaultLanguage = cookies.language || (!ALLOW_LANDING_PAGE ? 'EN' : '');
  const [language, setLanguage] = useState(defaultLanguage);

  useEffect(() => {
    if (language && cookies.language !== language) {
      setCookie('language', language, { path: '/' });
    }
  }, [language, setCookie, cookies.language]);

  const value = { language, setLanguage };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
