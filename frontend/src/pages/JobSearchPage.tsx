// JobSearchPage.tsx
import React, { useState, useId } from "react";
import { useNavigate } from "react-router-dom";
import styled, { createGlobalStyle, keyframes } from "styled-components";
import sparkyImage from '../assets/images/sparky.png';

/* -------------------- Global styles (font + resets) -------------------- */
const GlobalStyle = createGlobalStyle`
  /* Poppins – close to the mock’s rounded, modern look */
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

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
  background: var(--asu-gold);
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
const shimmer = keyframes`
  0%   { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
`;

const UploadStrip = styled.section`
  max-width: 1100px;
  margin: 18px auto 28px;
  padding: 18px 20px;
  border-radius: 16px;
  border: 2px solid #EAD893;

  /* soft gold gradient like the mock; animates subtly on hover/focus */
  background: linear-gradient(90deg, #FFF4C8, #FFE38F 50%, #FFE9A6);
  background-size: 200% 200%;
  transition: box-shadow .25s ease, transform .15s ease;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  &:hover, &:focus-within {
    animation: ${shimmer} 3.5s linear infinite;
    box-shadow: 0 8px 20px rgba(139, 21, 56, 0.08);
  }

  @media (max-width: 720px){
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
`;

const UploadLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
`;

const Mascot = styled.img`
  width: 52px;
  height: 52px;
  border-radius: 999px;
  flex: 0 0 auto;
  object-fit: cover;
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
  background: var(--asu-maroon);
  color: #fff;
  border: 0;
  border-radius: 999px;
  padding: 12px 22px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 6px 14px rgba(139, 21, 56, 0.22);
  transition: transform .15s ease, background .2s ease, box-shadow .2s ease;

  &:hover { background: var(--asu-maroon-dark); transform: translateY(-1px); }
  &:active { transform: translateY(0); box-shadow: 0 4px 10px rgba(139,21,56,.18); }
`;

/* --------------------------- Profile section --------------------------- */
const Card = styled.section`
  max-width: 1100px;
  margin: 0 auto;
  background: var(--surface);
  border-radius: 18px;
  padding: 36px;
  box-shadow: 0 10px 30px rgba(0,0,0,.06);
`;

const ProfileHeader = styled.div`
  text-align: center;
  margin-bottom: 28px;
`;

const Avatar = styled.div`
  width: 82px; height: 82px; margin: 0 auto 16px;
  border-radius: 999px; background: var(--asu-maroon);
  color: #fff; display: grid; place-items: center; font-size: 32px;
`;

const Heading = styled.h2`
  margin: 0;
  font-size: 1.9rem;
  font-weight: 700;
  text-shadow: 0 2px 0 rgba(0,0,0,0.07);
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

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--ink-700);
  font-size: 0.98rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 16px;
  background: var(--surface-muted);
  outline: none;
  transition: border-color .15s ease, box-shadow .15s ease;

  &:focus{
    border-color: var(--asu-gold-dark);
    box-shadow: 0 0 0 4px rgba(255, 198, 39, .25);
    background: #fff;
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
  transition: border-color .15s ease, box-shadow .15s ease;

  &:focus{
    border-color: var(--asu-gold-dark);
    box-shadow: 0 0 0 4px rgba(255, 198, 39, .25);
    background: #fff;
  }
`;

const Proceed = styled.button`
  display: block;
  margin: 40px auto 0;
  background: var(--asu-maroon);
  color: #fff;
  border: 0;
  border-radius: 999px;
  padding: 14px 40px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform .15s ease, background .2s ease, box-shadow .2s ease;
  box-shadow: 0 10px 22px rgba(139, 21, 56, 0.25);

  &:hover { background: var(--asu-maroon-dark); transform: translateY(-2px); }
  &:active { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(139,21,56,.22); }
`;

/* --------------------------------- Page -------------------------------- */
const JobSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputId = useId();

  const [formData, setFormData] = useState({
    fullName: "",
    location: "",
    headline: "",
    aboutMe: "",
    education: "",
    experience: "",
    email: "",
    interests: "",
    linkedin: ""
  });

  const onChange =
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    };

  const handleResume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // TODO: hook your parsing/upload flow here.
    // For now, just give a quick visual acknowledgement:
    alert(`Selected resume: ${file.name}`);
  };

  return (
    <>
      <GlobalStyle />
      <Page>
        <Header>
          <Title>Welcome to ASU Job Search!</Title>
          <DateText>{new Date().toLocaleDateString(undefined, {
            weekday: "short", day: "2-digit", month: "long", year: "numeric"
          })}</DateText>
        </Header>

        {/* Upload announcement strip */}
        <UploadStrip>
          <UploadLeft>
            <Mascot src={sparkyImage} alt="Sparky mascot" />
            <UploadMessage>
              I can help you get your profile set up by just uploading your Resume!
            </UploadMessage>
          </UploadLeft>

          <div>
            <HiddenFile id={fileInputId} accept=".pdf,.doc,.docx" onChange={handleResume}/>
            <UploadBtn htmlFor={fileInputId} role="button" aria-label="Upload Resume">
              Upload Resume
            </UploadBtn>
          </div>
        </UploadStrip>

        {/* Profile card */}
        <Card>
          <ProfileHeader>
            <Avatar aria-hidden>👤</Avatar>
            <Heading>My Profile</Heading>
          </ProfileHeader>

          <Grid>
            <Field>
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" name="fullName" placeholder="Your First Name" value={formData.fullName} onChange={onChange}/>
            </Field>

            <Field>
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="City, State" value={formData.location} onChange={onChange}/>
            </Field>

            <Field>
              <Label htmlFor="headline">Headline</Label>
              <Input id="headline" name="headline" placeholder="Your First Name" value={formData.headline} onChange={onChange}/>
            </Field>

            <Field>
              <Label htmlFor="aboutMe">About Me</Label>
              <TextArea id="aboutMe" name="aboutMe" placeholder="100–200 Character Description" value={formData.aboutMe} onChange={onChange}/>
            </Field>

            <Field>
              <Label htmlFor="education">Education</Label>
              <Input id="education" name="education" placeholder="Select a School" value={formData.education} onChange={onChange}/>
            </Field>

            <Field>
              <Label htmlFor="experience">Experience</Label>
              <TextArea id="experience" name="experience" placeholder="List your Experience Here" value={formData.experience} onChange={onChange}/>
            </Field>

            <Field>
              <Label htmlFor="email">Email, Phone Number</Label>
              <Input id="email" name="email" placeholder="Email, Phone Number" value={formData.email} onChange={onChange}/>
            </Field>

            <Field>
              <Label htmlFor="interests">Interests</Label>
              <TextArea id="interests" name="interests" placeholder="List Interests here" value={formData.interests} onChange={onChange}/>
            </Field>

            <Field>
              <Label htmlFor="linkedin">LinkedIn</Label>
              <Input id="linkedin" name="linkedin" placeholder="LinkedIn Profile URL" value={formData.linkedin} onChange={onChange}/>
            </Field>
          </Grid>

          <Proceed onClick={() => navigate("/job-options", { state: { userName: formData.fullName || "User" } })}>
            Proceed to Job Search
          </Proceed>
        </Card>
      </Page>
    </>
  );
};

export default JobSearchPage;
