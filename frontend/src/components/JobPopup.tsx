import React from 'react';
import styled from 'styled-components';
import triASU from '../assets/images/triASU.png';

const PopupOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const PopupContainer = styled.div`
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 1000px;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
`;

const PopupHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h2`
  margin: 0;
  color: #333;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  
  &:hover {
    color: #333;
  }
`;

const JobGrid = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const JobCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
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

const RequirementsContent = styled.div`
  flex: 1;
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

const TriASUContainer = styled.div`
  position: absolute;
  right: 20px;
  bottom: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const TriASULogo = styled.img`
  width: 80px;
  height: auto;
  cursor: pointer;
  margin-bottom: 8px;
`;

const InsightText = styled.p`
  font-size: 12px;
  color: #666;
  margin: 0;
  text-align: center;
  cursor: pointer;
`;

const UserFitModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
`;

const UserFitContent = styled.div`
  background: white;
  padding: 24px;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  position: relative;
`;

const UserFitTitle = styled.h3`
  color: #8B1538;
  margin: 0 0 16px 0;
  font-size: 1.2rem;
`;

const UserFitText = styled.p`
  color: #333;
  line-height: 1.6;
  margin: 0;
`;

interface Job {
  "Job Id": string;
  "Job Title": string;
  "Job Description": string;
  "Employer Name": string;
  "Salary Pay Upper Cap": string;
  "Salary Pay Lower Cap": string;
  "Location": string;
  "Employment Type": string;
  "Industry"?: string;
  "Required Experience": string;
  "User_fit"?: string;
}

interface JobPopupProps {
  jobs: Job[];
  onClose: () => void;
}

const JobPopup: React.FC<JobPopupProps> = ({ jobs, onClose }) => {
  const [selectedUserFit, setSelectedUserFit] = React.useState<string | null>(null);

  const formatSalary = (lower: string, upper: string) => {
    if (lower === "Not specified" || upper === "Not specified") {
      return "Salary not specified";
    }
    return `$${parseInt(lower).toLocaleString()}-$${parseInt(upper).toLocaleString()}/year`;
  };

  const getCompanyInitials = (companyName: string) => {
    return companyName.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleTriASUClick = (userFit: string | undefined) => {
    if (userFit) {
      setSelectedUserFit(userFit);
    }
  };

  return (
    <PopupOverlay onClick={onClose}>
      <PopupContainer onClick={(e) => e.stopPropagation()}>
        <PopupHeader>
          <Title>Job Recommendations</Title>
          <CloseButton onClick={onClose}>×</CloseButton>
        </PopupHeader>
        
        <JobGrid>
          {jobs.map((job) => (
            <JobCard key={job["Job Id"]}>
              <TriASUContainer onClick={() => handleTriASUClick(job["User_fit"])}>
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
                  {job["Industry"] && <li>Industry: {job["Industry"]}</li>}
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
      </PopupContainer>
      
      {selectedUserFit && (
        <UserFitModal onClick={() => setSelectedUserFit(null)}>
          <UserFitContent onClick={(e) => e.stopPropagation()}>
            <UserFitTitle>Job Fit Analysis</UserFitTitle>
            <UserFitText>{selectedUserFit}</UserFitText>
            <CloseButton 
              onClick={() => setSelectedUserFit(null)}
              style={{ position: 'absolute', top: '10px', right: '15px' }}
            >
              ×
            </CloseButton>
          </UserFitContent>
        </UserFitModal>
      )}
    </PopupOverlay>
  );
};

export default JobPopup;