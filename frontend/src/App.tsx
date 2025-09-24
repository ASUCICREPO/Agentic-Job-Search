import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import ProfilePage from './pages/ProfilePage';
import JobOptionsPage from './pages/JobOptionsPage';
import ChatBotPage from './pages/ChatBotPage';
import { getOrCreateSessionId } from './services/agentService';
import './App.css';

function App() {
  // Initialize session ID on app mount/refresh
  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    console.log('App initialized with session ID:', sessionId);
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<ProfilePage />} />
          <Route path="/job-options" element={<JobOptionsPage />} />
          <Route path="/chatbot" element={<ChatBotPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;