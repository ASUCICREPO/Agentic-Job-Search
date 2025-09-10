// profileService.ts — Upload to S3 first (browser) → then call Lambdas
// Uses AWS SDK v3 in the browser. Requires AWS creds available at build/runtime.
// Env vars expected (CRA-style):
//   REACT_APP_AWS_REGION=us-west-2
//   REACT_APP_AWS_ACCESS_KEY_ID=...
//   REACT_APP_AWS_SECRET_ACCESS_KEY=...
//   REACT_APP_AWS_SESSION_TOKEN=...        (optional, only needed for temporary credentials)
//   REACT_APP_RESUME_BUCKET=jobsearch1-resumebucketd07ccf44-l8h8v5hmexrl
//   REACT_APP_RESUME_PROCESSOR_URL=https://4566b7h7rszoztro6pzruefy4e0qfccu.lambda-url.us-west-2.on.aws/
//   REACT_APP_SAVE_PROFILE_URL=https://mltl55hbav4zpk5a3ocqsazzpm0yncnt.lambda-url.us-west-2.on.aws/
//
// Notes:
// - Make sure your bucket CORS allows PUT from your frontend origin.
// - The IAM principal for these creds must allow s3:PutObject on the bucket/key.
// - We save under a collision-safe key at the bucket root: "<timestamp>-<originalName>".

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const REGION = process.env.REACT_APP_AWS_REGION || 'us-west-2';
const ACCESS_KEY_ID = process.env.REACT_APP_AWS_ACCESS_KEY_ID || '';
const SECRET_ACCESS_KEY = process.env.REACT_APP_AWS_SECRET_ACCESS_KEY || '';
const SESSION_TOKEN = process.env.REACT_APP_AWS_SESSION_TOKEN || '';

const RESUME_BUCKET =
  process.env.REACT_APP_RESUME_BUCKET ||
  'jobsearch1-resumebucketd07ccf44-l8h8v5hmexrl';

const RESUME_PROCESSOR_URL =
  process.env.REACT_APP_RESUME_PROCESSOR_URL ||
  'https://4566b7h7rszoztro6pzruefy4e0qfccu.lambda-url.us-west-2.on.aws/';

const SAVE_PROFILE_URL =
  process.env.REACT_APP_SAVE_PROFILE_URL ||
  'https://mltl55hbav4zpk5a3ocqsazzpm0yncnt.lambda-url.us-west-2.on.aws/';

export interface ProfileData {
  fullName: string;
  location: string;
  headline: string;
  aboutMe: string;
  education: string;
  experience: string;
  email: string;
  phone: string;
  interests: string;
  linkedin: string;
}

// ---------- helpers ----------
function requireBrowserCreds() {
  if (!ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error(
      'AWS credentials missing in frontend. Provide AWS creds via REACT_APP_AWS_ACCESS_KEY_ID / REACT_APP_AWS_SECRET_ACCESS_KEY.'
    );
  }
}

function s3(): S3Client {
  requireBrowserCreds();
  const credentials: any = {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  };
  
  // Only add sessionToken if it exists (for temporary credentials)
  if (SESSION_TOKEN) {
    credentials.sessionToken = SESSION_TOKEN;
  }
  
  return new S3Client({
    region: REGION,
    credentials,
  });
}

function safeName(name: string): string {
  // keep original name characters that are S3-safe; avoid spaces
  return name.replace(/\s+/g, '-').replace(/[^A-Za-z0-9._\-]/g, '');
}

async function postJson(url: string, body: any) {
  console.log(`🌐 Making POST request to: ${url}`);
  console.log('📤 Request payload:', JSON.stringify(body, null, 2));
  
  const resp = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  
  console.log(`📡 Response status: ${resp.status} ${resp.statusText}`);
  
  const raw = await resp.text();
  console.log('📥 Raw response:', raw);
  
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
    console.log('📊 Parsed response data:', JSON.stringify(data, null, 2));
  } catch (parseError) {
    console.error('❌ Failed to parse JSON response:', parseError);
    throw new Error(`Non-JSON response from ${url}: ${raw}`);
  }
  
  if (!resp.ok) {
    const msg = data?.error || data?.message || raw || `HTTP ${resp.status}`;
    console.error('❌ HTTP error response:', msg);
    throw new Error(msg);
  }
  
  return data;
}

function toSchema(src: any): ProfileData {
  const get = (k: keyof ProfileData) => {
    const v = src?.[k as string];
    return v == null || String(v).trim() === '' ? 'N/A' : String(v).trim();
  };
  return {
    fullName: get('fullName'),
    location: get('location'),
    headline: get('headline'),
    aboutMe: get('aboutMe'),
    education: get('education'),
    experience: get('experience'),
    email: get('email'),
    phone: get('phone'),
    interests: get('interests'),
    linkedin: get('linkedin'),
  };
}

// ---------- main flow ----------

// 1) Save the resume to S3 FIRST
async function uploadResumeToS3(file: File): Promise<string> {
  console.log('🚀 Starting S3 upload process...');
  console.log(`📄 File details: name=${file.name}, size=${file.size} bytes, type=${file.type}`);
  
  const client = s3();
  const key = `${Date.now()}-${safeName(file.name)}`; // root-level key
  const s3Path = `s3://${RESUME_BUCKET}/${key}`;
  
  console.log(`📁 Uploading to S3: bucket=${RESUME_BUCKET}, key=${key}`);
  console.log(`🔗 Full S3 path: ${s3Path}`);
  
  try {
    // Convert File to ArrayBuffer to avoid streaming issues
    const arrayBuffer = await file.arrayBuffer();
    
    await client.send(
      new PutObjectCommand({
        Bucket: RESUME_BUCKET,
        Key: key,
        Body: arrayBuffer,
        ContentType: file.type || 'application/octet-stream',
      })
    );
    console.log('✅ S3 upload completed successfully');
    return s3Path;
  } catch (error) {
    console.error('❌ S3 upload failed:', error);
    throw new Error(`Failed to upload resume to S3: ${error}`);
  }
}

// 2) Call Resume Processor strictly with TOP-LEVEL { s3_path }
async function invokeResumeProcessor(s3_path: string) {
  console.log('🔄 Invoking Resume Processor Lambda...');
  console.log(`🔗 Lambda URL: ${RESUME_PROCESSOR_URL}`);
  console.log(`📍 S3 path being sent: ${s3_path}`);
  
  try {
    // Your backend expects { "s3_path": "s3://bucket-name/path/to/resume.pdf" }
    const payload = { s3_path };
    console.log('📤 Sending payload to Lambda:', JSON.stringify(payload, null, 2));
    
    const data = await postJson(RESUME_PROCESSOR_URL, payload);
    console.log('📥 Received response from Resume Processor:', JSON.stringify(data, null, 2));
    
    const result = data?.parsed_data ?? data;
    console.log('✅ Resume processing completed successfully');
    return result;
  } catch (error) {
    console.error('❌ Resume Processor Lambda failed:', error);
    throw error;
  }
}

// Public API for UI
export const uploadResumeAndParse = async (file: File): Promise<ProfileData> => {
  console.log('🎯 Starting complete resume upload and parse workflow...');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Step 1: Upload to S3 first (guarantees object exists; prevents NoSuchKey)
    console.log('📋 Step 1: Uploading resume to S3...');
    const s3_path = await uploadResumeToS3(file);
    console.log(`✅ Step 1 completed. S3 path: ${s3_path}`);

    // Step 2: Then ask backend to parse from that s3_path
    console.log('📋 Step 2: Processing resume with Lambda...');
    const parsed = await invokeResumeProcessor(s3_path);
    console.log('✅ Step 2 completed. Raw parsed data received.');

    // Step 3: Normalize to EXACT 10-field schema (missing -> "N/A")
    console.log('📋 Step 3: Normalizing data to profile schema...');
    const profileData = toSchema(parsed);
    console.log('📊 Final profile data:', JSON.stringify(profileData, null, 2));
    console.log('🎉 Complete workflow finished successfully!');
    
    return profileData;
  } catch (error) {
    console.error('💥 Upload and parse workflow failed:', error);
    throw error;
  }
};

// Save with EXACT schema
export const saveProfile = async (profileData: ProfileData): Promise<void> => {
  console.log('💾 Starting profile save process...');
  console.log(`🔗 Save Profile Lambda URL: ${SAVE_PROFILE_URL}`);
  
  try {
    const payload = toSchema(profileData);
    console.log('📤 Sending profile data to Save Profile Lambda:', JSON.stringify(payload, null, 2));
    
    const resp = await fetch(SAVE_PROFILE_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    console.log(`📡 Save Profile Lambda response status: ${resp.status}`);
    
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('❌ Save Profile Lambda failed:', errorText);
      throw new Error(`Failed to save profile: ${resp.status} - ${errorText}`);
    }
    
    console.log('✅ Profile saved successfully!');
  } catch (error) {
    console.error('💥 Profile save process failed:', error);
    throw error;
  }
};
