// ProfilePage.tsx
import React, { useState, useId } from "react";
import { useNavigate } from "react-router-dom";
import styled, { createGlobalStyle } from "styled-components";
import sparkyImage from '../assets/images/sparky.svg';
import myProfileImage from '../assets/images/my_profile.png';
import { uploadResumeAndParse, saveProfile, getProfile, ProfileData } from '../services/profileService';
import { getUserEmail, setUserEmail } from '../utils/cookieUtils';

/* -------------------- Global styles (font + resets) -------------------- */
const GlobalStyle = createGlobalStyle`
  :root{
    --asu-gold: #FFC627;
    --asu-gold-dark: #E6B400;
    --asu-maroon: #8B1538;
    --asu-maroon-dark: #6d1028;
    --ink-900:#000000;
    --ink-700:#333333;
    --ink-500:#666666;
    --ink-300:#9AA0A6;
    --surface:#FFFFFF;
    --surface-muted:#F8F9FA;
    --border:#E6E6E6;
  }

  * { box-sizing: border-box; }
  html, body, #root { height: 100%; }
  body {
    margin: 0;
    font-family: 'Poppins', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    color: var(--ink-900);
    background: var(--asu-gold);
  }

  ::placeholder { color: #A6ACB2; opacity: 1; }
`;

/* ------------------------------ Layout --------------------------------- */
const Page = styled.div`
  min-height: 100vh;
  padding: 40px 20px 72px;
  background: linear-gradient(135deg, #FFC627 0%, #FFB000 100%);
`;

const Header = styled.header`
  max-width: 1100px;
  margin: 0 auto 20px;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 2.25rem;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.2px;
`;

const DateText = styled.p`
  margin: 6px 0 0;
  color: var(--ink-500);
  font-size: 0.95rem;
`;

/* ---------------------- Upload Resume announcement --------------------- */
const UploadStrip = styled.section`
  padding: 24px 64px;
  background: linear-gradient(90deg, #FFF8E1 0%, #FFE082 50%, #FFC627 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;

  @media (max-width: 720px){
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 14px;
    padding: 18px 32px;
  }
`;

const UploadLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
`;

const Mascot = styled.img`
  width: 50px;
  height: 71px;
  flex: 0 0 auto;
`;

const UploadMessage = styled.p`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ink-900);
  text-wrap: balance;
`;

/* Hidden file input + visible button label */
const HiddenFile = styled.input.attrs({ type: "file" })`
  position: absolute !important;
  width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
`;

const UploadBtn = styled.label`
  cursor: pointer;
  background: #8C1D40;
  color: #fff;
  border: 0;
  border-radius: 999px;
  padding: 12px 24px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  transition: background .2s ease;

  &:hover { background: #6d1730; }
  
  &:has(input:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

/* --------------------------- Profile section --------------------------- */
const Card = styled.section`
  max-width: 1100px;
  margin: 0 auto;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
`;

const ProfileSection = styled.div`
  padding: 32px 64px 40px 64px;
  
  @media (max-width: 720px){
    padding: 24px 32px 32px 32px;
  }
`;

const ProfileHeader = styled.div`
  text-align: center;
  margin-bottom: 28px;
`;

const Avatar = styled.div`
  width: 82px; height: 82px; margin: 0 auto 16px;
  border-radius: 999px; background: var(--asu-maroon);
  display: grid; place-items: center;
  background-image: url(${myProfileImage});
  background-size: cover;
  background-position: center;
`;

const Heading = styled.h2`
  margin: 0;
  font-size: 1.9rem;
  font-weight: 700;
  text-shadow: 0 2px 0 rgba(0,0,0,0.07);
`;

const EditMessage = styled.div<{ $show: boolean }>`
  margin-top: 8px;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #FFF8E1 0%, #FFE082 50%);
  border: 1px solid var(--asu-gold);
  border-radius: 12px;
  font-size: 0.9rem;
  color: var(--ink-700);
  text-align: center;
  display: ${props => props.$show ? 'block' : 'none'};
  animation: fadeIn 0.5s ease-in-out;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  &::before {
    content: "✏️ ";
    font-size: 1.1rem;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 26px 28px;

  @media (max-width: 900px){
    grid-template-columns: 1fr;
  }
`;

const Field = styled.div``;

const Label = styled.label<{ $required?: boolean }>`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--ink-700);
  font-size: 0.98rem;

  &::after {
    content: ${props => props.$required ? '" *"' : '""'};
    color: #dc3545;
    font-weight: 700;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 16px;
  background: var(--surface-muted);
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
  cursor: text;

  &:focus{
    border-color: var(--asu-gold-dark);
    box-shadow: 0 0 0 4px rgba(255, 198, 39, .25);
    background: #fff;
  }

  &:not(:disabled):hover {
    border-color: var(--asu-gold);
    background: #fff;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--surface-muted);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 104px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 16px;
  background: var(--surface-muted);
  resize: vertical;
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
  cursor: text;

  &:focus{
    border-color: var(--asu-gold-dark);
    box-shadow: 0 0 0 4px rgba(255, 198, 39, .25);
    background: #fff;
  }

  &:not(:disabled):hover {
    border-color: var(--asu-gold);
    background: #fff;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--surface-muted);
  }
`;

const NotificationAndButtonContainer = styled.div`
  margin-top: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;

  @media (max-width: 900px) {
    align-items: stretch;
  }
`;

const NotificationContainer = styled.div`
  width: 100%;
  max-width: 500px;
`;

const NotificationSection = styled.div`
  padding: 12px;
  background: var(--surface-muted);
  border-radius: 8px;
  border: 1px solid var(--border);
`;

const NotificationTitle = styled.h3`
  margin: 0 0 12px 0;
  color: var(--ink-700);
  font-size: 16px;
  font-weight: 600;
`;

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const RadioOption = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RadioInput = styled.input`
  width: 16px;
  height: 16px;
  accent-color: var(--asu-maroon);
`;

const RadioLabel = styled.label`
  font-size: 13px;
  color: var(--ink-700);
  cursor: pointer;
`;

const CommunicationSection = styled.div<{ $show: boolean }>`
  margin-top: 12px;
  padding: 10px;
  background: white;
  border-radius: 6px;
  border: 1px solid var(--border);
  display: ${props => props.$show ? 'block' : 'none'};
`;

const CommunicationTitle = styled.h4`
  margin: 0 0 8px 0;
  color: var(--ink-700);
  font-size: 13px;
  font-weight: 600;
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

const CheckboxOption = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const CheckboxInput = styled.input`
  width: 14px;
  height: 14px;
  accent-color: var(--asu-maroon);
`;

const CheckboxLabel = styled.label`
  font-size: 13px;
  color: var(--ink-700);
  cursor: pointer;
`;

const ValidationErrors = styled.div`
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 8px;
  color: #c33;
  font-size: 0.9rem;
  line-height: 1.4;

  ul {
    margin: 0;
    padding-left: 20px;
  }

  li {
    margin-bottom: 4px;

    &:last-child {
      margin-bottom: 0;
    }
  }
`;

const Proceed = styled.button`
  margin: 0;
  display: block;
  background: var(--asu-maroon);
  color: #fff;
  border: 0;
  border-radius: 999px;
  padding: 16px 48px;
  font-size: 1.15rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform .15s ease, background .2s ease, box-shadow .2s ease;
  box-shadow: 0 12px 24px rgba(139, 21, 56, 0.3);
  min-width: 200px;

  &:hover { background: var(--asu-maroon-dark); transform: translateY(-2px); }
  &:active { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(139,21,56,.22); }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

/* ----------------------------- Loading Modal ----------------------------- */
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 20px;
  padding: 40px;
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  border: 2px solid var(--asu-gold);
`;

const LoadingIcon = styled.div`
  width: 60px;
  height: 60px;
  margin: 0 auto 20px;
  border: 4px solid var(--asu-gold);
  border-top: 4px solid var(--asu-maroon);
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ModalTitle = styled.h3`
  color: var(--asu-maroon);
  margin: 0 0 10px;
  font-size: 1.4rem;
  font-weight: 700;
`;

const ModalMessage = styled.p`
  color: var(--ink-700);
  margin: 0;
  font-size: 1rem;
  line-height: 1.5;
`;

/* --------------------------------- Page -------------------------------- */
const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputId = useId();


  const [formData, setFormData] = useState<ProfileData>({
    fullName: "",
    location: "",
    headline: "",
    aboutMe: "",
    education: "",
    experience: "",
    email: "",
    phone: "",
    preferredJobRole: "",
    linkedin: "",
    optInStatus: false,
    communicationMethod: ""
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dataAutoFilled, setDataAutoFilled] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const onChange =
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;

      // Enforce character limits for text areas
      let processedValue = value;
      if (['headline', 'aboutMe', 'education', 'experience'].includes(name)) {
        processedValue = value.slice(0, 200);
      }

      setFormData(prev => ({ ...prev, [name]: processedValue }));
      // Clear validation errors when user starts typing
      if (validationErrors.length > 0) {
        setValidationErrors([]);
      }
    };

  // Helper function to convert communication method to backend format
  const getCommunicationMethodValue = (methods: string[]): string => {
    if (methods.length === 0) return '';
    if (methods.length === 1) return methods[0];
    return 'both';
  };

  // Helper function to check if at least one communication method is selected
  const hasValidCommunicationMethod = (): boolean => {
    const method = formData.communicationMethod || '';
    return method === 'email' || method === 'phone' || method === 'both';
  };

  // Helper function to get communication methods as array for checkbox state
  const getCommunicationMethodsArray = (): string[] => {
    const method = formData.communicationMethod || '';
    if (method === 'both') return ['email', 'phone'];
    if (method === 'email') return ['email'];
    if (method === 'phone') return ['phone'];
    return [];
  };

  // Validation function
  const validateForm = (): boolean => {
    const errors: string[] = [];

    // Required fields validation
    if (!formData.fullName.trim()) {
      errors.push("Full Name is required");
    }
    if (!formData.email.trim()) {
      errors.push("Email is required");
    }
    if (!formData.phone.trim()) {
      errors.push("Phone Number is required");
    }

    // Communication method validation when opt-in is enabled
    if (formData.optInStatus === true) {
      if (!hasValidCommunicationMethod()) {
        errors.push("At least one communication method must be selected when opt-in is enabled");
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Load existing profile data on component mount
  React.useEffect(() => {
    const loadExistingProfile = async () => {
      const storedEmail = getUserEmail();
      if (storedEmail) {
        setIsLoadingProfile(true);
        try {
          const existingProfile = await getProfile(storedEmail);
          if (existingProfile) {
            setFormData(existingProfile);
            console.log('✅ Loaded existing profile data from DynamoDB');
          } else {
            console.log('ℹ️ No existing profile found, starting fresh');
          }
        } catch (error) {
          console.error('❌ Failed to load existing profile:', error);
          // Don't show error to user, just continue with empty form
        } finally {
          setIsLoadingProfile(false);
        }
      }
    };

    loadExistingProfile();
  }, []);

  const handleResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const parsedData = await uploadResumeAndParse(file);
      setFormData(parsedData);
      setDataAutoFilled(true);
    } catch (error) {
      alert('Failed to process resume. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    // Validate form before saving
    if (!validateForm()) {
      return; // Stop if validation fails
    }

    setIsSaving(true);
    try {
      await saveProfile(formData);

      // Store email in cookie for future visits
      if (formData.email) {
        setUserEmail(formData.email);
        console.log('✅ User email stored in cookie for future visits');
      }

      // Always navigate directly to job options after saving
      navigate("/job-options", { state: { userName: formData.fullName || "User" } });
    } catch (error) {
      console.error('Save profile error:', error);
      alert(`Failed to save profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSaving(false);
    }
  };

  return (
    <>
      <GlobalStyle />

      {/* Loading Modal */}
      {(isUploading || isSaving || isLoadingProfile) && (
        <ModalOverlay>
          <ModalContent>
            <LoadingIcon />
            <ModalTitle>
              {isLoadingProfile ? 'Loading Your Profile' :
               isUploading ? 'Processing Your Resume' : 'Saving Your Profile'}
            </ModalTitle>
            <ModalMessage>
              {isLoadingProfile ? 'Please wait while we retrieve your saved profile information...' :
               isUploading
                ? 'Please wait while we analyze your resume and extract your information...'
                : 'Please wait while we save your profile information...'
              }
            </ModalMessage>
          </ModalContent>
        </ModalOverlay>
      )}

      <Page>
        <Header>
          <Title>Welcome to ASU Job Search!</Title>
          <DateText>{new Date().toLocaleDateString(undefined, {
            weekday: "short", day: "2-digit", month: "long", year: "numeric"
          })}</DateText>
        </Header>

        {/* Upload announcement strip */}
        {/* Combined Profile card with upload section */}
        <Card>
          <UploadStrip>
            <UploadLeft>
              <Mascot src={sparkyImage} alt="Sparky mascot" />
              <UploadMessage>
                I will help you set up your profile. Just upload your resume!
              </UploadMessage>
            </UploadLeft>

            <div>
              <HiddenFile id={fileInputId} accept=".pdf,.doc,.docx" onChange={handleResume} disabled={isUploading || isSaving || isLoadingProfile}/>
              <UploadBtn htmlFor={fileInputId} role="button" aria-label="Upload Resume">
                {isUploading ? '🔄 Processing Resume...' : 'Upload Resume'}
              </UploadBtn>
            </div>
          </UploadStrip>

          <ProfileSection>
            <ProfileHeader>
              <Avatar aria-hidden></Avatar>
              <Heading>My Profile</Heading>
            </ProfileHeader>

            <EditMessage $show={dataAutoFilled}>
              You can edit any of the information below if the extracted resume needs corrections!
            </EditMessage>

            <Grid>
            <Field>
              <Label htmlFor="fullName" $required>Full Name</Label>
              <Input id="fullName" name="fullName" placeholder="Full name" value={formData.fullName} onChange={onChange} disabled={isUploading || isSaving || isLoadingProfile}/>
            </Field>

            <Field>
              <Label htmlFor="email" $required>Email</Label>
              <Input id="email" name="email" placeholder="Email address" value={formData.email} onChange={onChange} disabled={isUploading || isSaving || isLoadingProfile}/>
            </Field>

            <Field>
              <Label htmlFor="phone" $required>Phone Number</Label>
              <Input id="phone" name="phone" placeholder="Phone number" value={formData.phone} onChange={onChange} disabled={isUploading || isSaving || isLoadingProfile}/>
            </Field>

            <Field>
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="City, State" value={formData.location} onChange={onChange} disabled={isUploading || isSaving || isLoadingProfile}/>
            </Field>

            <Field>
              <Label htmlFor="headline">Headline</Label>
              <TextArea id="headline" name="headline" placeholder="Professional headline (200 characters max)" value={formData.headline} onChange={onChange} disabled={isUploading || isSaving || isLoadingProfile}/>
            </Field>

            <Field>
              <Label htmlFor="aboutMe">About Me</Label>
              <TextArea id="aboutMe" name="aboutMe" placeholder="Tell us about yourself, your background, interests, and career goals (200 characters max)" value={formData.aboutMe} onChange={onChange} disabled={isUploading || isSaving || isLoadingProfile}/>
            </Field>

            <Field>
              <Label htmlFor="education">Education</Label>
              <TextArea id="education" name="education" placeholder="List any diplomas, degrees, or certifications. (200 characters max)" value={formData.education} onChange={onChange} disabled={isUploading || isSaving || isLoadingProfile}/>
            </Field>

            <Field>
              <Label htmlFor="experience">Experience</Label>
              <TextArea id="experience" name="experience" placeholder="List jobs, community service, and more (200 characters max)" value={formData.experience} onChange={onChange} disabled={isUploading || isSaving || isLoadingProfile}/>
            </Field>

            <Field>
              <Label htmlFor="preferredJobRole">Preferred Job Role</Label>
              <Input id="preferredJobRole" name="preferredJobRole" placeholder="Preferred job role" value={formData.preferredJobRole} onChange={onChange} disabled={isUploading || isSaving || isLoadingProfile}/>
            </Field>

            <Field>
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input id="linkedin" name="linkedin" placeholder="LinkedIn profile URL" value={formData.linkedin} onChange={onChange} disabled={isUploading || isSaving || isLoadingProfile}/>
            </Field>
          </Grid>

          <NotificationAndButtonContainer>
            <NotificationContainer>
              <NotificationTitle>Job Notification Preferences</NotificationTitle>
              <NotificationSection>
                <RadioGroup>
                  <RadioOption>
                    <RadioInput
                      type="radio"
                      id="notifications-yes"
                      name="jobNotifications"
                      value="true"
                      checked={formData.optInStatus === true}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, optInStatus: true }));
                        // Clear validation errors when changing notification preference
                        if (validationErrors.length > 0) {
                          setValidationErrors([]);
                        }
                      }}
                      disabled={isUploading || isSaving || isLoadingProfile}
                    />
                    <RadioLabel htmlFor="notifications-yes">Yes, I want to receive job notifications</RadioLabel>
                  </RadioOption>
                  <RadioOption>
                    <RadioInput
                      type="radio"
                      id="notifications-no"
                      name="jobNotifications"
                      value="false"
                      checked={formData.optInStatus === false}
                      onChange={(e) => {
                        setFormData(prev => ({
                          ...prev,
                          optInStatus: false,
                          communicationMethod: ''
                        }));
                        // Clear validation errors when changing notification preference
                        if (validationErrors.length > 0) {
                          setValidationErrors([]);
                        }
                      }}
                      disabled={isUploading || isSaving || isLoadingProfile}
                    />
                    <RadioLabel htmlFor="notifications-no">No, I don't want job notifications</RadioLabel>
                  </RadioOption>
                </RadioGroup>

                <CommunicationSection $show={formData.optInStatus === true}>
                  <CommunicationTitle>Preferred Communication Method *</CommunicationTitle>
                  {formData.optInStatus === true && !hasValidCommunicationMethod() && (
                    <div style={{ color: '#d32f2f', fontSize: '12px', marginBottom: '8px' }}>
                      Please select at least one communication method to receive notifications.
                    </div>
                  )}
                  <CheckboxGroup>
                    <CheckboxOption>
                      <CheckboxInput
                        type="checkbox"
                        id="comm-email"
                        checked={getCommunicationMethodsArray().includes('email')}
                        onChange={(e) => {
                          const currentMethods = getCommunicationMethodsArray();
                          let newMethods: string[];
                          if (e.target.checked) {
                            newMethods = [...currentMethods, 'email'];
                          } else {
                            newMethods = currentMethods.filter(m => m !== 'email');
                          }
                          setFormData(prev => ({ ...prev, communicationMethod: getCommunicationMethodValue(newMethods) }));
                          // Clear validation errors when changing communication methods
                          if (validationErrors.length > 0) {
                            setValidationErrors([]);
                          }
                        }}
                        disabled={isUploading || isSaving || isLoadingProfile}
                      />
                      <CheckboxLabel htmlFor="comm-email">Email</CheckboxLabel>
                    </CheckboxOption>
                    <CheckboxOption>
                      <CheckboxInput
                        type="checkbox"
                        id="comm-phone"
                        checked={getCommunicationMethodsArray().includes('phone')}
                        onChange={(e) => {
                          const currentMethods = getCommunicationMethodsArray();
                          let newMethods: string[];
                          if (e.target.checked) {
                            newMethods = [...currentMethods, 'phone'];
                          } else {
                            newMethods = currentMethods.filter(m => m !== 'phone');
                          }
                          setFormData(prev => ({ ...prev, communicationMethod: getCommunicationMethodValue(newMethods) }));
                          // Clear validation errors when changing communication methods
                          if (validationErrors.length > 0) {
                            setValidationErrors([]);
                          }
                        }}
                        disabled={isUploading || isSaving || isLoadingProfile}
                      />
                      <CheckboxLabel htmlFor="comm-phone">Phone (SMS)</CheckboxLabel>
                    </CheckboxOption>
                  </CheckboxGroup>
                </CommunicationSection>
              </NotificationSection>
            </NotificationContainer>

            {validationErrors.length > 0 && (
              <ValidationErrors>
                <strong>Please fix the following issues:</strong>
                <ul>
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </ValidationErrors>
            )}

            <Proceed onClick={handleSaveProfile} disabled={isUploading || isSaving || isLoadingProfile || validationErrors.length > 0 || (formData.optInStatus === true && !hasValidCommunicationMethod())}>
              {isSaving ? '💾 Saving Profile...' : 'Proceed to Job Search'}
            </Proceed>
          </NotificationAndButtonContainer>
          </ProfileSection>
        </Card>
      </Page>
    </>
  );
};

export default ProfilePage;
