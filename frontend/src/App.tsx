import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import JobSearchPage from './pages/JobSearchPage';
import JobOptionsPage from './pages/JobOptionsPage';
import ChatBotPage from './pages/ChatBotPage';
import JobRecommendationPage from './pages/JobRecommendationPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/job-search" element={<JobSearchPage />} />
          <Route path="/job-options" element={<JobOptionsPage />} />
          <Route path="/chatbot" element={<ChatBotPage />} />
          <Route path="/job-recommendations" element={<JobRecommendationPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;