// profileService.ts — Upload to S3 first (browser) → then call Lambdas
// Uses AWS SDK v3 in the browser. Requires permanent AWS credentials available at build/runtime.
// REQUIRED Env vars (CRA-style, no fallbacks):
//   REACT_APP_AWS_REGION=...                   (AWS region)
//   REACT_APP_AWS_ACCESS_KEY_ID=...           (permanent access key)
//   REACT_APP_AWS_SECRET_ACCESS_KEY=...       (permanent secret key)
//   REACT_APP_RESUME_BUCKET=...               (S3 bucket for resumes)
//   REACT_APP_RESUME_PROCESSOR_URL=...        (Lambda URL for resume processing)
//   REACT_APP_SAVE_PROFILE_URL=...            (Lambda URL for profile saving)
//
// Notes:
// - Make sure your bucket CORS allows PUT from your frontend origin.
// - The IAM principal for these creds must allow s3:PutObject on the bucket/key.
// - We save under a collision-safe key at the bucket root: "<timestamp>-<originalName>".

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const REGION = process.env.REACT_APP_AWS_REGION;
const ACCESS_KEY_ID = process.env.REACT_APP_AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.REACT_APP_AWS_SECRET_ACCESS_KEY;

const RESUME_BUCKET = process.env.REACT_APP_RESUME_BUCKET;

const RESUME_PROCESSOR_URL = process.env.REACT_APP_RESUME_PROCESSOR_URL;

const SAVE_PROFILE_URL = process.env.REACT_APP_SAVE_PROFILE_URL;

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
  if (!REGION) {
    throw new Error('REACT_APP_AWS_REGION environment variable is required');
  }
  if (!ACCESS_KEY_ID) {
    throw new Error('REACT_APP_AWS_ACCESS_KEY_ID environment variable is required');
  }
  if (!SECRET_ACCESS_KEY) {
    throw new Error('REACT_APP_AWS_SECRET_ACCESS_KEY environment variable is required');
  }
  if (!RESUME_BUCKET) {
    throw new Error('REACT_APP_RESUME_BUCKET environment variable is required');
  }
  if (!RESUME_PROCESSOR_URL) {
    throw new Error('REACT_APP_RESUME_PROCESSOR_URL environment variable is required');
  }
  if (!SAVE_PROFILE_URL) {
    throw new Error('REACT_APP_SAVE_PROFILE_URL environment variable is required');
  }
}

function s3(): S3Client {
  requireBrowserCreds();
  return new S3Client({
    region: REGION!,
    credentials: {
      accessKeyId: ACCESS_KEY_ID!,
      secretAccessKey: SECRET_ACCESS_KEY!,
    },
  });
}

function safeName(name: string): string {
  // keep original name characters that are S3-safe; avoid spaces
  return name.replace(/\s+/g, '-').replace(/[^A-Za-z0-9._-]/g, '');
}

async function postJson(url: string, body: any) {
  const resp = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const raw = await resp.text();

  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (parseError) {
    console.error('Failed to parse JSON response:', parseError);
    throw new Error(`Non-JSON response from ${url}: ${raw}`);
  }

  if (!resp.ok) {
    const msg = data?.error || data?.message || raw || `HTTP ${resp.status}`;
    console.error('HTTP error response:', msg);
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
  const client = s3();
  const key = `${Date.now()}-${safeName(file.name)}`; // root-level key
  const s3Path = `s3://${RESUME_BUCKET}/${key}`;

  try {
    // Convert File to ArrayBuffer and then to Uint8Array for AWS SDK compatibility
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    await client.send(
      new PutObjectCommand({
        Bucket: RESUME_BUCKET!,
        Key: key,
        Body: uint8Array,
        ContentType: file.type || 'application/octet-stream',
      })
    );
    return s3Path;
  } catch (error) {
    console.error('S3 upload failed:', error);
    throw new Error(`Failed to upload resume to S3: ${error}`);
  }
}

// 2) Call Resume Processor strictly with TOP-LEVEL { s3_path }
async function invokeResumeProcessor(s3_path: string) {
  try {
    // Your backend expects { "s3_path": "s3://bucket-name/path/to/resume.pdf" }
    const payload = { s3_path };
    const data = await postJson(RESUME_PROCESSOR_URL!, payload);

    const result = data?.parsed_data ?? data;
    return result;
  } catch (error) {
    console.error('Resume Processor Lambda failed:', error);
    throw error;
  }
}

// Public API for UI
export const uploadResumeAndParse = async (file: File): Promise<ProfileData> => {
  try {
    // Step 1: Upload to S3 first (guarantees object exists; prevents NoSuchKey)
    const s3_path = await uploadResumeToS3(file);

    // Step 2: Then ask backend to parse from that s3_path
    const parsed = await invokeResumeProcessor(s3_path);

    // Step 3: Normalize to EXACT 10-field schema (missing -> "N/A")
    const profileData = toSchema(parsed);

    return profileData;
  } catch (error) {
    console.error('Upload and parse workflow failed:', error);
    throw error;
  }
};

// Save with EXACT schema
export const saveProfile = async (profileData: ProfileData): Promise<void> => {
  try {
    const schemaData = toSchema(profileData);
    const payload = {
      parsed_data: schemaData
    };

    await postJson(SAVE_PROFILE_URL!, payload);
  } catch (error) {
    console.error('Profile save process failed:', error);
    throw error;
  }
};
