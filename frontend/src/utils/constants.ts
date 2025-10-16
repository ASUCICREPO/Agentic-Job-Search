/**
 * Centralized Environment Variables
 * All .env variables are loaded and exported from here
 */

// AWS Configuration
export const AWS_REGION = process.env.REACT_APP_AWS_REGION;
export const COGNITO_IDENTITY_POOL_ID = process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID;

// Agent Configuration
export const AGENT_RUNTIME_ARN = process.env.REACT_APP_AGENT_RUNTIME_ARN;
export const AGENT_QUALIFIER = process.env.REACT_APP_AGENT_QUALIFIER || 'DEFAULT';

// S3 Configuration
export const RESUME_BUCKET = process.env.REACT_APP_RESUME_BUCKET;

// API Endpoints
export const RESUME_PROCESSOR_URL = process.env.REACT_APP_RESUME_PROCESSOR_URL;
export const SAVE_PROFILE_URL = process.env.REACT_APP_SAVE_PROFILE_URL;
export const JOB_RECOMMENDATIONS_API_URL = process.env.REACT_APP_JOB_RECOMMENDATIONS_API_URL;
export const AGENT_PROXY_URL = process.env.REACT_APP_AGENT_PROXY_URL;

