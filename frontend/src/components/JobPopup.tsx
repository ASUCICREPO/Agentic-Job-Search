import React from 'react';
import styled from 'styled-components';
import { saveProfile, getProfile, ProfileData } from '../services/profileService';
import { getUserEmail } from '../utils/cookieUtils';

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
  width: 95%;
  max-width: 1200px;
  max-height: 90vh;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const PopupHeader = styled.div`
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  background: white;
  border-radius: 12px 12px 0 0;
`;

const JobHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
`;


const NotificationToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const JobChipsContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
`;

const JobChip = styled.span`
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #495057;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  align-self: flex-start;
`;

const ToggleLabel = styled.label<{ $isAutoChecked?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  cursor: pointer;
  font-size: 0.8rem;
  color: ${props => props.$isAutoChecked ? '#8B1538' : '#333'};
  font-weight: 500;
  position: relative;

  &::before {
    content: ${props => props.$isAutoChecked ? '"(Matches your preferred role)"' : '""'};
    font-size: 0.6rem;
    color: #8B1538;
    font-weight: 400;
    margin-bottom: 2px;
    white-space: nowrap;
  }

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const ToggleSwitch = styled.div<{ $isOn: boolean }>`
  position: relative;
  width: 32px;
  height: 18px;
  background: ${props => props.$isOn ? '#8B1538' : '#ccc'};
  border-radius: 9px;
  transition: background 0.2s ease;
  cursor: pointer;
  flex-shrink: 0;

  &::after {
    content: '';
    position: absolute;
    top: 2px;
    left: ${props => props.$isOn ? '16px' : '2px'};
    width: 14px;
    height: 14px;
    background: white;
    border-radius: 50%;
    transition: left 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
`;

const ToggleInput = styled.input`
  display: none;
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
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  border-radius: 0 0 12px 12px;
  width: 100%;
`;

const JobCard = styled.div`
  background: white;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-left: 3px solid #FFC627;
  position: relative;
  transition: box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
`;


const JobInfo = styled.div`
  flex: 0 0 auto;
  min-width: 0;
`;

const JobTitle = styled.h3`
  color: #333;
  font-size: 1.1rem;
  margin: 0 0 1px 0;
  font-weight: 600;
`;

const Company = styled.p`
  color: #666;
  margin: 0 0 4px 0;
  font-size: 0.85rem;
`;


const JobDescription = styled.p`
  color: #555;
  line-height: 1.4;
  margin: 4px 0;
  font-size: 0.9rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const RequirementsContent = styled.div`
  margin: 4px 0;
`;

const RequirementsTitle = styled.h4`
  color: #333;
  font-size: 0.9rem;
  margin: 0 0 2px 0;
  font-weight: 600;
`;

const RequirementsList = styled.ul`
  margin: 0;
  padding-left: 16px;
  color: #555;
  font-size: 0.85rem;
  line-height: 1.3;
`;

const ButtonContainer = styled.div`
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: stretch;
  }

  @media (max-width: 480px) {
    gap: 12px;
  }
`;

const ApplyButton = styled.button`
  background: #8B1538;
  color: white;
  border: none;
  padding: 10px 24px;
  border-radius: 25px;
  font-weight: 600;
  cursor: pointer;
  width: auto;
  min-width: 140px;
  max-width: 200px;
  font-size: 0.9rem;
  transition: all 0.2s ease;
  box-shadow: 0 3px 6px rgba(139, 21, 56, 0.25);
  margin: 0;
  margin-bottom: 10px;
  display: inline-block;

  &:hover {
    background: #6d1028;
    transform: translateY(-1px);
    box-shadow: 0 5px 12px rgba(139, 21, 56, 0.35);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(139, 21, 56, 0.2);
  }
`;


const WhyThisMatchesContainer = styled.div`
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border: 1px solid #e9ecef;
  border-radius: 12px;
  padding: 20px;
  margin: 10px 0 5px 0;
  box-shadow: 0 4px 12px rgba(200, 200, 200, 0.15);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(240, 240, 240, 0.2);
    border-radius: 12px;
    z-index: -1;
  }
`;

const WhyThisMatchesTitle = styled.h4`
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: 700;
  color: #8B1538;
`;

const WhyThisMatchesText = styled.p`
  margin: 0;
  font-size: 14px;
  color: #000000;
  line-height: 1.5;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
`;


interface Job {
  id: string;
  title: string;
  description: string;
  company: string;
  salary_max: string;
  salary_min: string;
  location: string;
  type: string;
  industry?: string;
  experience: string;
  fit?: string;
  remote?: string;
}

interface JobPopupProps {
  jobs: Job[];
  onClose: () => void;
  selectedJobRole?: string;
}

const JobPopup: React.FC<JobPopupProps> = ({ jobs, onClose, selectedJobRole }) => {
  const [jobNotifications, setJobNotifications] = React.useState<{ [jobId: string]: boolean }>({});
  const [autoEnabledJobs, setAutoEnabledJobs] = React.useState<Set<string>>(new Set());
  const [initialJobNotifications, setInitialJobNotifications] = React.useState<{ [jobId: string]: boolean }>({});

  // Load user profile and auto-check notifications based on job title matches
  React.useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const userEmail = getUserEmail();
        if (userEmail) {
          const profile = await getProfile(userEmail);
          if (profile && profile.preferredJobRole && profile.preferredJobRole !== 'N/A' && profile.preferredJobRole.trim() !== '') {
            const autoEnabledNotifications: { [jobId: string]: boolean } = {};
            const autoEnabledJobIds = new Set<string>();

            // Split preferred roles by comma and compare each individually
            const preferredRoles = profile.preferredJobRole.split(',').map(role => role.trim());

            jobs.forEach(job => {
              // Check if any of the preferred roles match this job title
              const hasMatch = preferredRoles.some(role => {
                const roleLower = role.toLowerCase();
                const titleLower = job.title.toLowerCase();
                return titleLower.includes(roleLower) || roleLower.includes(titleLower);
              });

              if (hasMatch) {
                autoEnabledNotifications[job.id] = true;
                autoEnabledJobIds.add(job.id);
              }
            });

            if (Object.keys(autoEnabledNotifications).length > 0) {
              setJobNotifications(autoEnabledNotifications);
              setAutoEnabledJobs(autoEnabledJobIds);
            }

            // Save the initial state for comparison (whether auto-enabled or empty)
            setInitialJobNotifications({...autoEnabledNotifications});
          }
        }
      } catch (error) {
        // Failed to load user profile
      }
    };

    loadUserProfile();
  }, [jobs]);


  // Check if job notifications have changed from initial state
  const hasNotificationsChanged = (): boolean => {
    const currentKeys = Object.keys(jobNotifications);
    const initialKeys = Object.keys(initialJobNotifications);

    // If different number of keys, something changed
    if (currentKeys.length !== initialKeys.length) {
      return true;
    }

    // Check if any notification state has changed
    for (const jobId of currentKeys) {
      if (jobNotifications[jobId] !== initialJobNotifications[jobId]) {
        return true;
      }
    }

    return false;
  };

  const formatSalary = (lower: string, upper: string) => {
    if (lower === "Not specified" || upper === "Not specified") {
      return "Salary not specified";
    }

    // Clean the salary values by removing $ and commas
    const cleanLower = lower.replace(/[$,]/g, '');
    const cleanUpper = upper.replace(/[$,]/g, '');

    // Parse as integers and format
    const lowerNum = parseInt(cleanLower);
    const upperNum = parseInt(cleanUpper);

    if (isNaN(lowerNum) || isNaN(upperNum)) {
      return "Salary information unavailable";
    }

    return `$${lowerNum.toLocaleString()}-$${upperNum.toLocaleString()}/year`;
  };


  const handleJobToggleChange = (jobId: string, enabled: boolean) => {
    setJobNotifications(prev => ({
      ...prev,
      [jobId]: enabled
    }));

    // If user manually disables an auto-enabled job, remove it from auto-enabled set
    if (!enabled && autoEnabledJobs.has(jobId)) {
      setAutoEnabledJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  const handleClose = async () => {
    // Only save profile if user actually changed any notification settings
    if (hasNotificationsChanged()) {
      const enabledJobs = Object.entries(jobNotifications).filter(([_, enabled]) => enabled);
      const disabledJobs = Object.entries(jobNotifications).filter(([_, enabled]) => !enabled);

      // Do this in background without blocking UI
      (async () => {
        try {
          const userEmail = getUserEmail();

          if (userEmail) {
            // Get current profile data
            const currentProfile = await getProfile(userEmail);

            if (currentProfile) {
              // Get the job titles for enabled notifications
              const enabledJobTitles = enabledJobs.map(([jobId, _]) => {
                const job = jobs.find(j => j.id === jobId);
                return job?.title || '';
              }).filter(title => title);

              // Get the job titles for disabled notifications
              const disabledJobTitles = disabledJobs.map(([jobId, _]) => {
                const job = jobs.find(j => j.id === jobId);
                return job?.title || '';
              }).filter(title => title);

              // Remove duplicates from enabled job titles first
              const uniqueEnabledJobTitles = Array.from(new Set(enabledJobTitles));

              // Get existing preferred job roles
              let existingRoles: string[] = [];
              if (currentProfile.preferredJobRole && currentProfile.preferredJobRole.trim()) {
                existingRoles = currentProfile.preferredJobRole.split(',').map(role => role.trim());
              }

              // Start with existing roles
              let updatedRoles = [...existingRoles];

              // Add new enabled job titles
              uniqueEnabledJobTitles.forEach(title => {
                if (!updatedRoles.some(role => role.toLowerCase() === title.toLowerCase())) {
                  updatedRoles.push(title);
                }
              });

              // Remove disabled job titles
              disabledJobTitles.forEach(title => {
                const index = updatedRoles.findIndex(role => role.toLowerCase() === title.toLowerCase());
                if (index > -1) {
                  updatedRoles.splice(index, 1);
                }
              });

              // Remove duplicates (case-insensitive) and preserve original casing
              const uniqueRoles = Array.from(new Set(
                updatedRoles.map(role => role.toLowerCase())
              )).map(lowercaseRole =>
                updatedRoles.find(role => role.toLowerCase() === lowercaseRole) || lowercaseRole
              );

              const updatedProfile: ProfileData = {
                ...currentProfile,
                preferredJobRole: uniqueRoles.length > 0 ? uniqueRoles.join(', ') : ''
              };

              // Save the updated profile in background
              await saveProfile(updatedProfile);
            }
          }
        } catch (error) {
          // Profile update failed
        }
      })();
    }

    // Close immediately without waiting
    onClose();
  };

  return (
    <PopupOverlay onClick={handleClose}>
      <PopupContainer onClick={(e) => e.stopPropagation()}>
        <PopupHeader>
          <Title>Job Recommendations</Title>
          <CloseButton onClick={handleClose}>
            ×
          </CloseButton>
        </PopupHeader>
        
        <JobGrid>
          {jobs.map((job) => (
            <JobCard key={job.id}>
              <JobHeader>
                <JobInfo>
                  <JobTitle>{job.title}</JobTitle>
                  <Company>{job.company}</Company>
                </JobInfo>
                <NotificationToggleContainer>
                  <ToggleLabel $isAutoChecked={autoEnabledJobs.has(job.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ToggleInput
                        type="checkbox"
                        checked={jobNotifications[job.id] || false}
                        onChange={(e) => handleJobToggleChange(job.id, e.target.checked)}
                      />
                      <ToggleSwitch $isOn={jobNotifications[job.id] || false} />
                      <span>Notify me for similar roles</span>
                    </div>
                  </ToggleLabel>
                </NotificationToggleContainer>
              </JobHeader>

              <JobChipsContainer>
                <JobChip>📍 {job.location}</JobChip>
                <JobChip>💰 {formatSalary(job.salary_min, job.salary_max)}</JobChip>
                {job.industry && <JobChip>🏢 {job.industry}</JobChip>}
                <JobChip>{job.type}</JobChip>
                {job.remote === "yes" && <JobChip>Remote</JobChip>}
              </JobChipsContainer>

              <JobDescription>{job.description}</JobDescription>

              <RequirementsContent>
                <RequirementsTitle>Requirements:</RequirementsTitle>
                <RequirementsList>
                  <li>{job.experience !== "Not specified" ? `Experience: ${job.experience}` : "Experience requirements not specified"}</li>
                </RequirementsList>
              </RequirementsContent>

              <WhyThisMatchesContainer>
                <WhyThisMatchesTitle>Why this matches you</WhyThisMatchesTitle>
                <WhyThisMatchesText>
                  {job.fit || "This role aligns with your profile and career goals based on your experience and preferences."}
                </WhyThisMatchesText>
              </WhyThisMatchesContainer>

              <ButtonContainer>
                <ApplyButton onClick={() => alert(`Applying to ${job.title} at ${job.company}`)}>
                  Apply Now
                </ApplyButton>
              </ButtonContainer>
            </JobCard>
          ))}
        </JobGrid>
      </PopupContainer>
    </PopupOverlay>
  );
};

export default JobPopup;