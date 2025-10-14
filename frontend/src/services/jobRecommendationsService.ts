import { JOB_RECOMMENDATIONS_API_URL } from '../utils/constants';

export interface JobRecommendation {
  userJobKey: string;
  createdAt: string;
  email: string;
  jobCategory: string;
  jobInformation: any[];
}

function requireApiUrl() {
  if (!JOB_RECOMMENDATIONS_API_URL) {
    throw new Error('REACT_APP_JOB_RECOMMENDATIONS_API_URL environment variable is required');
  }
}

async function getJson(url: string) {
  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    headers: { 'Content-Type': 'application/json' },
  });

  const raw = await response.text();

  if (!response.ok) {
    console.error('HTTP error response:', raw);
    throw new Error(`HTTP ${response.status}: ${raw}`);
  }

  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (parseError) {
    console.error('Failed to parse JSON response:', parseError);
    console.error('Raw response:', raw);
    throw new Error(`Non-JSON response from ${url}: ${parseError}`);
  }

  return data;
}

// Get job recommendations by userJobKey and createdAt
export const getJobRecommendations = async (
  userJobKey: string,
  createdAt: string
): Promise<JobRecommendation> => {
  try {
    requireApiUrl();

    // Encode URL parameters to handle special characters like # in userJobKey
    const encodedUserJobKey = encodeURIComponent(userJobKey);
    const encodedCreatedAt = encodeURIComponent(createdAt);
    const url = `${JOB_RECOMMENDATIONS_API_URL}/job-recommendations/${encodedUserJobKey}/${encodedCreatedAt}`;

    console.log('Fetching job recommendations from:', url);

    const data = await getJson(url);

    // Transform the response to match our interface
    // Parse jobInformation if it's a string or DynamoDB format
    let jobInformation = data.jobInformation;
    
    // Handle DynamoDB List format {L: [...]}
    if (jobInformation && typeof jobInformation === 'object' && jobInformation.L) {
      jobInformation = jobInformation.L;
    }
    
    // Parse if it's a string
    if (typeof jobInformation === 'string') {
      try {
        jobInformation = JSON.parse(jobInformation);
      } catch (e) {
        console.error('Failed to parse jobInformation:', e);
        jobInformation = [];
      }
    }
    
    return {
      userJobKey: data.userJobKey,
      createdAt: data.createdAt,
      email: data.email,
      jobCategory: data.jobCategory,
      jobInformation: Array.isArray(jobInformation) ? jobInformation : []
    };
  } catch (error) {
    console.error('Job recommendations fetch failed:', error);
    throw error;
  }
};

// Utility function to parse URL parameters from SMS links
export const parseSmsLinkParams = (): { userJobKey?: string; createdAt?: string } | null => {
  const urlParams = new URLSearchParams(window.location.search);

  const userJobKey = urlParams.get('userJobKey');
  const createdAt = urlParams.get('createdAt');

  if (userJobKey && createdAt) {
    return { userJobKey, createdAt };
  }

  return null;
};
