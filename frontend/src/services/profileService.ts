import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { 
  AWS_REGION, 
  COGNITO_IDENTITY_POOL_ID, 
  RESUME_BUCKET, 
  RESUME_PROCESSOR_URL, 
  SAVE_PROFILE_URL 
} from '../utils/constants';

export interface ProfileData {
  fullName: string;
  location: string;
  headline: string;
  aboutMe: string;
  education: string;
  experience: string;
  email: string;
  phone: string;
  preferredJobRole: string;
  linkedin: string;
  optInStatus: boolean;
  communicationMethod: string;
}

// ---------- helpers ----------
function requireBrowserCreds() {
  if (!AWS_REGION) {
    throw new Error('REACT_APP_AWS_REGION environment variable is required');
  }
  if (!COGNITO_IDENTITY_POOL_ID) {
    throw new Error('REACT_APP_COGNITO_IDENTITY_POOL_ID environment variable is required');
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
    region: AWS_REGION!,
    credentials: fromCognitoIdentityPool({
      client: new CognitoIdentityClient({ region: AWS_REGION! }),
      identityPoolId: COGNITO_IDENTITY_POOL_ID!,
    }),
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

  // Handle optInStatus specifically as boolean
  const optInValue = src?.optInStatus;
  const optInStatus = typeof optInValue === 'boolean' ? optInValue :
                     typeof optInValue === 'string' ? optInValue.toLowerCase() === 'true' :
                     false;

  return {
    fullName: get('fullName'),
    location: get('location'),
    headline: get('headline'),
    aboutMe: get('aboutMe'),
    education: get('education'),
    experience: get('experience'),
    email: get('email'),
    phone: get('phone'),
    preferredJobRole: get('preferredJobRole'),
    linkedin: get('linkedin'),
    optInStatus: optInStatus,
    communicationMethod: get('communicationMethod'),
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

// Convert UI format to backend format
function toBackendFormat(profileData: ProfileData) {
  const baseData = toSchema(profileData);

  return {
    ...baseData,
    optInStatus: profileData.optInStatus, 
  };
}

// Save with backend format
export const saveProfile = async (profileData: ProfileData): Promise<void> => {
  try {
    const backendData = toBackendFormat(profileData);
    const payload = {
      parsed_data: backendData
    };

    await postJson(SAVE_PROFILE_URL!, payload);
  } catch (error) {
    console.error('Profile save process failed:', error);
    throw error;
  }
};

// Convert backend format to UI format
function fromBackendFormat(backendData: any): ProfileData {
  const uiData = toSchema(backendData);

  // Convert optInStatus from backend to UI format
  uiData.optInStatus = Boolean(backendData.optInStatus);
  uiData.communicationMethod = backendData.communicationMethod || '';

  return uiData;
}

// Retrieve profile by email
export const getProfile = async (email: string): Promise<ProfileData | null> => {
  try {
    const url = `${SAVE_PROFILE_URL}?email=${encodeURIComponent(email)}`;

    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
    });

    const raw = await response.text();
    let data: any = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      throw new Error(`Non-JSON response from ${url}: ${raw}`);
    }

    if (!response.ok) {
      const msg = data?.error || data?.message || raw || `HTTP ${response.status}`;
      console.error('HTTP error response:', msg);
      throw new Error(msg);
    }

    if (data.profile) {
      return fromBackendFormat(data.profile);
    } else {
      return null; // Profile not found
    }
  } catch (error) {
    console.error('Profile retrieval process failed:', error);
    throw error;
  }
};
