import React from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import asuLogo from '../assets/images/asu-logo.png';

const JobOptionsContainer = styled.div`
  min-height: 100vh;
  background: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 60px;
`;

const Logo = styled.img`
  height: 120px;
  width: auto;
  margin-bottom: 20px;
  object-fit: contain;
`;

const Title = styled.h1`
  font-size: 2.8rem;
  color: black;
  text-align: center;
  margin-bottom: 15px;
  font-weight: 600;
`;

const Subtitle = styled.p`
  font-size: 1.3rem;
  color: black;
  text-align: center;
  margin-bottom: 0;
  opacity: 0.8;
  font-weight: 400;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 25px;
  width: 100%;
  max-width: 500px;
`;

const OptionButton = styled.button`
  background: #FFC627;
  color: black;
  border: 3px solid #FFC627;
  padding: 25px 50px;
  font-size: 1.2rem;
  font-weight: 600;
  border-radius: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(255, 198, 39, 0.3);

  &:hover {
    background: white;
    color: #FFC627;
    border: 3px solid #FFC627;
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(255, 198, 39, 0.4);
  }
`;

const JobOptionsPage: React.FC = () => {
  const navigate = useNavigate();

  const handleResumeAnalysis = () => {
    navigate('/chatbot');
  };

  const handleJobMatching = () => {
    navigate('/chatbot');
  };

  const handleCareerGuidance = () => {
    navigate('/chatbot');
  };

  return (
    <JobOptionsContainer>
      <Header>
        <Logo src={asuLogo} alt="ASU Logo" />
        <Title>Welcome to ASU Job Search!</Title>
        <Subtitle>What are you looking for?</Subtitle>
      </Header>
      <ButtonContainer>
        <OptionButton onClick={handleResumeAnalysis}>
          I am looking for a part-time job
        </OptionButton>
        <OptionButton onClick={handleJobMatching}>
          I am looking for a full-time job/ internships
        </OptionButton>
        <OptionButton onClick={handleCareerGuidance}>
          I am exploring career paths
        </OptionButton>
      </ButtonContainer>
    </JobOptionsContainer>
  );
};

export default JobOptionsPage;