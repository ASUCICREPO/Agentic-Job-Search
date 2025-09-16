import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';

const Container = styled.div`
  min-height: 100vh;
  background: #f5f5f5;
`;

const Header = styled.div`
  background: #b71c1c;
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
  max-width: 800px;
  margin: 0 auto;
`;

const JobCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-left: 4px solid #b71c1c;
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
  background: #b71c1c;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  flex: 1;
`;

const SaveButton = styled.button`
  background: #ffc107;
  color: #333;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  flex: 1;
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

const InsightIcon = styled.div`
  position: absolute;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  width: 60px;
  height: 60px;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 10 L70 40 L50 30 L30 40 Z" fill="%23ffc107"/><rect x="45" y="30" width="10" height="40" fill="%23ffc107"/></svg>') no-repeat center;
  background-size: contain;
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
        // Look for job_agent_result containing the job array
        const jobResultMatch = textResponse.match(/"job_agent_result":\s*"(\[[\s\S]*?\])\\n"/);
        if (jobResultMatch) {
          try {
            // Properly unescape the JSON string
            let jobJsonString = jobResultMatch[1];
            jobJsonString = jobJsonString.replace(/\\n/g, '').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            jobData = JSON.parse(jobJsonString);
            console.log('Successfully parsed job data:', jobData);
          } catch (error) {
            console.error('Error parsing job_agent_result:', error);
            console.log('Raw job string:', jobResultMatch[1]);
          }
        } else {
          console.log('No job_agent_result found in response');
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
        <Subtitle>Based on your UI/UX Designer preferences</Subtitle>
        <InsightIcon />
      </Header>

      <JobGrid>
        {jobs.map((job) => (
          <JobCard key={job["Job Id"]}>
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
            
            <Requirements>
              <RequirementsTitle>Requirements:</RequirementsTitle>
              <RequirementsList>
                <li>Proficiency with Figma, Sketch, or Adobe XD</li>
                <li>Strong portfolio showcasing interaction design and visual design skills</li>
                <li>Bachelor's degree in a UI/UX related field</li>
              </RequirementsList>
            </Requirements>

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