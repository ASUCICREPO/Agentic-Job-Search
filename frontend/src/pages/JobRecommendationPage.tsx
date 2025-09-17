import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';
import triASU from '../assets/images/triASU.png';

const Container = styled.div`
  min-height: 100vh;
  background: #f5f5f5;
`;

const Header = styled.div`
  background: #8B1538;
  color: white;
  padding: 20px;
  position: relative;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 15px;
  right: 20px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const Title = styled.h1`
  color: white;
  font-size: 1.8rem;
  margin: 0 0 5px 0;
  font-weight: 600;
`;

const Subtitle = styled.p`
  color: #ffcc80;
  font-size: 1rem;
  margin: 0;
`;

const JobGrid = styled.div`
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
`;

const JobCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #8B1538;
  position: relative;
`;

const JobHeader = styled.div`
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
`;

const CompanyIcon = styled.div`
  width: 40px;
  height: 40px;
  background: #f0f0f0;
  border-radius: 4px;
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: #666;
`;

const JobInfo = styled.div`
  flex: 1;
`;

const JobTitle = styled.h3`
  color: #333;
  font-size: 1.3rem;
  margin: 0 0 4px 0;
  font-weight: 600;
`;

const Company = styled.p`
  color: #666;
  margin: 0;
  font-size: 0.9rem;
`;

const JobMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  margin: 12px 0;
  font-size: 0.9rem;
  color: #666;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const JobDescription = styled.p`
  color: #555;
  line-height: 1.6;
  margin: 16px 0;
`;

const Requirements = styled.div`
  margin: 16px 0;
`;

const RequirementsTitle = styled.h4`
  color: #333;
  font-size: 1rem;
  margin: 0 0 8px 0;
`;

const RequirementsList = styled.ul`
  margin: 0;
  padding-left: 20px;
  color: #555;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 20px;
`;

const ApplyButton = styled.button`
  background: #8B1538;
  color: white;
  border: none;
  padding: 16px 24px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  flex: 1;
  
  &:hover {
    background: #6d1028;
  }
`;

const SaveButton = styled.button`
  background: #ffc107;
  color: #333;
  border: none;
  padding: 16px 24px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  flex: 1;
  
  &:hover {
    background: #e0a800;
  }
`;

const RequirementsSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin: 16px 0;
`;

const RequirementsContent = styled.div`
  flex: 1;
`;

const TriASUContainer = styled.div`
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const TriASULogo = styled.img`
  width: 80px;
  height: auto;
  margin-bottom: 8px;
`;

const InsightText = styled.p`
  font-size: 12px;
  color: #666;
  margin: 0;
  text-align: center;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  background: #f5f5f5;
`;

const LoadingText = styled.p`
  color: #333;
  font-size: 1.2rem;
`;

interface Job {
  "Job Id": string;
  "Job Title": string;
  "Job Description": string;
  "Employer Name": string;
  "Salary Pay Upper Cap": string;
  "Salary Pay Lower Cap": string;
  "User_fit": string;
  "Location": string;
  "Employment Type": string;
  "Industry": string;
  "Application Deadline": string;
  "Remote Work": string;
  "Required Experience": string;
}

const JobRecommendationPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const query = location.state?.query || "software engineering jobs";

  useEffect(() => {
    fetchJobRecommendations();
  }, []);

  const fetchJobRecommendations = async () => {
    try {
      const client = new BedrockAgentCoreClient({
        region: process.env.REACT_APP_AWS_REGION!,
        credentials: {
          accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY!,
        },
      });

      const runtimeSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 20)}-extra`;

      const payload = {
        prompt: `Find job recommendations for: ${query}`,
        session_id: runtimeSessionId,
        source: "livesearch"
      };

      const input = {
        runtimeSessionId: runtimeSessionId,
        agentRuntimeArn: process.env.REACT_APP_AGENT_RUNTIME_ARN!,
        qualifier: process.env.REACT_APP_AGENT_QUALIFIER || "DEFAULT",
        payload: new TextEncoder().encode(JSON.stringify(payload)),
      };

      const command = new InvokeAgentRuntimeCommand(input);
      const response = await client.send(command);
      const textResponse = await response.response?.transformToString();
      
      console.log('Agent response:', textResponse);
      
      // Parse the streaming response to extract job data
      let jobData: Job[] = [];
      if (textResponse) {
        // Look specifically for the job array within job_agent_result
        const jobResultMatch = textResponse.match(/"job_agent_result":\s*"(\[[\s\S]*?\])\\n"/);
        if (jobResultMatch) {
          try {
            // Get the job array string and properly unescape it
            let jobJsonString = jobResultMatch[1];
            
            // Replace escaped characters
            jobJsonString = jobJsonString
              .replace(/\\n/g, '')  // Remove escaped newlines
              .replace(/\\"/g, '"') // Replace escaped quotes
              .replace(/\\\\/g, '\\'); // Replace escaped backslashes
            
            console.log('Parsing job array:', jobJsonString);
            jobData = JSON.parse(jobJsonString);
            console.log('Successfully parsed job data:', jobData);
          } catch (error) {
            console.error('Error parsing job array:', error);
            console.log('Raw job array that failed:', jobResultMatch[1]);
          }
        } else {
          console.log('No job array found in job_agent_result');
        }
      }

      setJobs(jobData);
    } catch (error) {
      console.error('Error fetching job recommendations:', error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const getJobCategory = (query: string) => {
    if (!query) return 'job search';
    
    // Remove common phrases and extract job category
    let cleaned = query.toLowerCase()
      .replace(/show me|find me|search for|looking for|i want|get me/g, '')
      .replace(/job recommendations for:|find job recommendations for:/g, '')
      .replace(/jobs?/g, '')
      .replace(/related/g, '')
      .replace(/full-time|part-time|remote/g, '')
      .trim();
    
    // Clean up extra spaces and return
    return cleaned.replace(/\s+/g, ' ').trim() || 'job search';
  };

  const formatSalary = (lower: string, upper: string) => {
    if (lower === "Not specified" || upper === "Not specified") {
      return "Salary not specified";
    }
    return `$${parseInt(lower).toLocaleString()}-$${parseInt(upper).toLocaleString()}/year`;
  };

  const getCompanyInitials = (companyName: string) => {
    return companyName.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Container>
        <LoadingContainer>
          <LoadingText>Finding the best job recommendations for you...</LoadingText>
        </LoadingContainer>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <CloseButton onClick={() => navigate('/chatbot')}>×</CloseButton>
        <Title>Recommended Jobs</Title>
        <Subtitle>Based on your {getJobCategory(query)} preferences</Subtitle>
      </Header>

      <JobGrid>
        {jobs.map((job) => (
          <JobCard key={job["Job Id"]}>
            <TriASUContainer>
              <TriASULogo src={triASU} alt="triASU" />
              <InsightText>Click here to view insights!</InsightText>
            </TriASUContainer>
            
            <JobHeader>
              <CompanyIcon>{getCompanyInitials(job["Employer Name"])}</CompanyIcon>
              <JobInfo>
                <JobTitle>{job["Job Title"]}</JobTitle>
                <Company>{job["Employer Name"]}</Company>
              </JobInfo>
            </JobHeader>
            
            <JobMeta>
              <MetaItem>📍 {job["Location"]}</MetaItem>
              <MetaItem>💰 {formatSalary(job["Salary Pay Lower Cap"], job["Salary Pay Upper Cap"])}</MetaItem>
              <MetaItem>⏰ {job["Employment Type"]}</MetaItem>
            </JobMeta>

            <JobDescription>{job["Job Description"]}</JobDescription>
            
            <RequirementsContent>
              <RequirementsTitle>Requirements:</RequirementsTitle>
              <RequirementsList>
                <li>{job["Required Experience"] !== "Not specified" ? `Experience: ${job["Required Experience"]}` : "Experience requirements not specified"}</li>
                <li>Industry: {job["Industry"]}</li>
                <li>Employment Type: {job["Employment Type"]}</li>
              </RequirementsList>
            </RequirementsContent>

            <ButtonContainer>
              <ApplyButton onClick={() => alert(`Applying to ${job["Job Title"]} at ${job["Employer Name"]}`)}>
                Apply Now
              </ApplyButton>
              <SaveButton onClick={() => alert(`Saved ${job["Job Title"]}`)}>
                Save Job
              </SaveButton>
            </ButtonContainer>
          </JobCard>
        ))}
      </JobGrid>
    </Container>
  );
};

export default JobRecommendationPage;