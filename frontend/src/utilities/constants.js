// --------------------------------------------------------------------------------------------------------//
// Primary color constants for the theme
export const PRIMARY_MAIN = "#930303"; // The main primary color used for buttons, highlights, etc.
export const primary_50 = "#6f98ec"; // The 50 variant of the primary color

// Background color constants
export const SECONDARY_MAIN = "#ffc627"; // The main secondary color used for less prominent elements

// Chat component background colors
export const CHAT_BODY_BACKGROUND = "#FFFFFF"; // Background color for the chat body area
export const CHAT_LEFT_PANEL_BACKGROUND = "#F7F9FE"; // Background color for the left panel in the chat
export const ABOUT_US_HEADER_BACKGROUND = "#930303"; // Background color for the About Us section in the left panel
export const FAQ_HEADER_BACKGROUND = "#316ADD"; // Background color for the FAQ section in the left panel
export const ABOUT_US_TEXT = "#000000"; // Text color for the About Us section in the left panel
export const FAQ_TEXT = "#000000"; // Text color for the FAQ section in the left panel
export const HEADER_BACKGROUND = "#ffc627"; // Background color for the header
export const HEADER_TEXT_GRADIENT = "#930303"; // Text gradient color for the header

// Message background colors
export const BOTMESSAGE_BACKGROUND = "#F8F8F8"; // Light gray background for messages sent by the bot
export const USERMESSAGE_BACKGROUND = "#FFE599"; // Light gold background for messages sent by the user

// --------------------------------------------------------------------------------------------------------//
// --------------------------------------------------------------------------------------------------------//

// Text Constants
export const TEXT = {
  EN: {
    APP_NAME: "Agentic Job Search",
    APP_ASSISTANT_NAME: "Job Search AI",
    ABOUT_US_TITLE: "About us",
    ABOUT_US:
      "The Agentic Job Search AI Assistant is an intelligent career guidance system that helps you discover relevant job opportunities tailored to your skills and experience. It analyzes your background, searches comprehensive job databases, and provides personalized recommendations with company insights and application strategies. This tool leverages advanced AI to streamline your job search process and connect you with the right opportunities.",
    FAQ_TITLE: "Frequently Asked Questions",
    FAQS: ["Find me software engineering jobs in San Francisco", "What companies are hiring entry-level data scientists?", "Show me remote marketing positions", "Find internships for computer science students"],
    CHAT_HEADER_TITLE: "Agentic Job Search AI Assistant",
    CHAT_INPUT_PLACEHOLDER: "Describe the job you're looking for...",
    HELPER_TEXT: "Cannot send empty message",
    SPEECH_RECOGNITION_START: "Start Listening",
    SPEECH_RECOGNITION_STOP: "Stop Listening",
    SPEECH_RECOGNITION_HELPER_TEXT: "Stop speaking to send the message", // New helper text
  },
  ES: {
    APP_NAME: "Búsqueda de Trabajo Agéntica",
    APP_ASSISTANT_NAME: "IA de Búsqueda de Trabajo",
    ABOUT_US_TITLE: "Sobre nosotros",
    ABOUT_US:
      "El Asistente de IA para Búsqueda de Trabajo Agéntica es un sistema inteligente de orientación profesional que te ayuda a descubrir oportunidades laborales relevantes adaptadas a tus habilidades y experiencia. Analiza tu perfil, busca en bases de datos integrales de empleos y proporciona recomendaciones personalizadas con información sobre empresas y estrategias de aplicación. Esta herramienta utiliza IA avanzada para optimizar tu proceso de búsqueda de empleo.",
    FAQ_TITLE: "Preguntas Frecuentes",
    FAQS: ["Encuentra trabajos de ingeniería de software en San Francisco", "¿Qué empresas están contratando científicos de datos junior?", "Muéstrame posiciones de marketing remoto", "Encuentra pasantías para estudiantes de ciencias de la computación"],
    CHAT_HEADER_TITLE: "Asistente de IA para Búsqueda de Trabajo Agéntica",
    CHAT_INPUT_PLACEHOLDER: "Describe el trabajo que buscas...",
    HELPER_TEXT: "No se puede enviar un mensaje vacío",
    SPEECH_RECOGNITION_START: "Iniciar Escucha",
    SPEECH_RECOGNITION_STOP: "Detener Escucha",
    SPEECH_RECOGNITION_HELPER_TEXT: "Deja de hablar para enviar el mensaje", // Nuevo texto de ayuda
  },
};

export const SWITCH_TEXT = {
  SWITCH_LANGUAGE_ENGLISH: "English",
  SWITCH_TOOLTIP_ENGLISH: "Language",
  SWITCH_LANGUAGE_SPANISH: "Español",
  SWITCH_TOOLTIP_SPANISH: "Idioma",
};

export const LANDING_PAGE_TEXT = {
  EN: {
    CHOOSE_LANGUAGE: "Choose language:",
    ENGLISH: "English",
    SPANISH: "Español",
    SAVE_CONTINUE: "Save and Continue",
    APP_ASSISTANT_NAME: "Agentic Job Search AI Assistant",
  },
  ES: {
    CHOOSE_LANGUAGE: "Elige el idioma:",
    ENGLISH: "English",
    SPANISH: "Español",
    SAVE_CONTINUE: "Guardar y continuar",
    APP_ASSISTANT_NAME: "Asistente de IA para Búsqueda de Trabajo Agéntica",
  },
};

// --------------------------------------------------------------------------------------------------------//
// --------------------------------------------------------------------------------------------------------//

// API endpoints

export const CHAT_API = process.env.REACT_APP_CHAT_API; // URL for the chat API endpoint
export const WEBSOCKET_API = process.env.REACT_APP_WEBSOCKET_API; // URL for the WebSocket API endpoint

// --------------------------------------------------------------------------------------------------------//
// --------------------------------------------------------------------------------------------------------//

// Features
export const ALLOW_FILE_UPLOAD = true; // Set to true to enable file upload feature
export const ALLOW_VOICE_RECOGNITION = false; // Set to true to enable voice recognition feature

export const ALLOW_MULTLINGUAL_TOGGLE = false; // Set to true to enable multilingual support
export const ALLOW_LANDING_PAGE = false; // Set to true to enable the landing page

// Development
export const LOCAL_DEV_MODE = true; // Set to true for local development (uses dummy AWS credentials)

// --------------------------------------------------------------------------------------------------------//
// Styling under work, would reccomend keeping it false for now
export const ALLOW_MARKDOWN_BOT = true; // Set to true to enable markdown support for bot messages
export const ALLOW_FAQ = false; // Set to true to enable the FAQs to be visible in Chat body
export const SHOW_FAQ_LEFT_NAV = false;
