import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ProfilePage from './pages/ProfilePage';
import JobOptionsPage from './pages/JobOptionsPage';
import ChatBotPage from './pages/ChatBotPage';
import './App.css';

function App() {
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