import React from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import asuLogo from '../assets/images/asu-logo.png';
import heroImage from '../assets/images/page1.png';

const HomeContainer = styled.div`
  min-height: 100vh;
  background: #f5f5f5;
`;

const TopBar = styled.div`
  background: #f0f0f0;
  padding: 20px 40px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 40px;
  font-size: 30px;
`;

const TopBarLink = styled.a`
  color: #666;
  text-decoration: none;
  font-weight: 500;
  &:hover { color: #8B1538; }
`;

const JobSearchTab = styled.div`
  background: #FFC627;
  color: #000;
  padding: 18px 30px;
  border-radius: 25px 25px 0 0;
  font-weight: 700;
  cursor: pointer;
  font-size: 20px;
`;

const Header = styled.header`
  background: white;
  padding: 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const Logo = styled.img`
  height: 60px;
`;

const ContentImage = styled.img`
  width: 100%;
  height: auto;
  display: block;
`;

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const handleJobSearchClick = () => {
    navigate('/job-search');
  };

  return (
    <HomeContainer>
      <TopBar>
        <JobSearchTab onClick={handleJobSearchClick}>ASU Job Search</JobSearchTab>
        <TopBarLink href="#">ASU Home</TopBarLink>
        <TopBarLink href="#">My ASU</TopBarLink>
        <TopBarLink href="#">Colleges and Schools</TopBarLink>
        <TopBarLink href="#">Sign In</TopBarLink>
      </TopBar>

      <ContentImage src={heroImage} alt="ASU Homepage" />
    </HomeContainer>
  );
};

export default HomePage;