#!/usr/bin/env python3
"""
DynamoDB tools for the Job Search Agent.
Contains functions for managing student profiles in DynamoDB.
"""

import os
import boto3
from typing import Any, Dict
from pydantic import BaseModel, Field
from strands import tool

# Comprehensive validation functions for DynamoDB security
def validate_email(email: str) -> str:
    """Validate email format and prevent injection"""
    if not email or not isinstance(email, str):
        raise ValueError("Email is required and must be a string")
    email = email.strip()
    if '@' not in email or '.' not in email.split('@')[1]:
        raise ValueError("Invalid email format")
    if len(email) < 5 or len(email) > 254:
        raise ValueError("Email length must be between 5 and 254 characters")
    allowed_chars = set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@.-_+')
    if not all(c in allowed_chars for c in email):
        raise ValueError("Email contains invalid characters")
    return email.lower()

def validate_job_category(job_category: str) -> str:
    """Validate job category format"""
    if not job_category or not isinstance(job_category, str):
        raise ValueError("Job category is required and must be a string")
    # Remove special characters, keep alphanumeric and hyphens
    sanitized = ''.join(c if c.isalnum() or c == '-' else '-' for c in job_category.lower())
    # Remove consecutive hyphens
    while '--' in sanitized:
        sanitized = sanitized.replace('--', '-')
    # Strip leading/trailing hyphens
    sanitized = sanitized.strip('-')
    # Length validation
    if len(sanitized) < 2 or len(sanitized) > 100:
        raise ValueError("Job category must be between 2 and 100 characters")
    return sanitized

def validate_job_information(job_info: list) -> list:
    """Validate job information structure"""
    if not isinstance(job_info, list):
        raise ValueError("Job information must be a list")
    if len(job_info) == 0:
        raise ValueError("Job information cannot be empty")
    if len(job_info) > 50:
        raise ValueError("Too many job recommendations (max 50)")

    validated_jobs = []
    required_fields = ['id', 'title', 'company', 'description']

    for job in job_info:
        if not isinstance(job, dict):
            continue
        # Validate required fields exist
        if not all(field in job for field in required_fields):
            continue
        # Validate and sanitize each field
        validated_job = {
            'id': validate_string(str(job.get('id', '')), 'id', 1, 100),
            'title': validate_string(job.get('title', ''), 'title', 1, 200),
            'description': validate_string(job.get('description', ''), 'description', 0, 5000),
            'company': validate_string(job.get('company', ''), 'company', 1, 200),
            'salary_max': validate_string(str(job.get('salary_max', 'Not specified')), 'salary_max', 0, 50),
            'salary_min': validate_string(str(job.get('salary_min', 'Not specified')), 'salary_min', 0, 50),
            'fit': validate_string(job.get('fit', ''), 'fit', 0, 1000),
            'location': validate_string(job.get('location', ''), 'location', 0, 100),
            'type': validate_string(job.get('type', ''), 'type', 0, 50),
            'industry': validate_string(job.get('industry', ''), 'industry', 0, 100),
            'deadline': validate_string(job.get('deadline', ''), 'deadline', 0, 50),
            'remote': validate_string(job.get('remote', 'no'), 'remote', 0, 10),
            'experience': validate_string(job.get('experience', ''), 'experience', 0, 100),
            'external_apply_url': validate_url(job.get('external_apply_url', ''))
        }
        validated_jobs.append(validated_job)

    return validated_jobs

def validate_string(value: str, field_name: str, min_len: int = 0, max_len: int = 500) -> str:
    """Validate and sanitize string fields"""
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string")
    value = value.strip()
    if len(value) < min_len or len(value) > max_len:
        raise ValueError(f"{field_name} must be between {min_len} and {max_len} characters")
    value = value.replace('<', '').replace('>', '').replace('&lt;', '').replace('&gt;', '')
    value = value.replace('\x00', '')
    return value

def validate_url(url: str) -> str:
    """Validate URL format"""
    if not url or not isinstance(url, str):
        return "N/A"
    if not url.startswith(('http://', 'https://')):
        return "N/A"
    url = url.replace('<', '').replace('>', '').replace('"', '').replace("'", '')
    if len(url) > 2048:
        return "N/A"
    return url

def validate_user_job_key(email: str, job_category: str) -> str:
    """Create and validate composite key"""
    email = validate_email(email)
    job_category = validate_job_category(job_category)
    user_job_key = f"{email}#{job_category}"
    if len(user_job_key) > 300:
        raise ValueError("User job key too long")
    return user_job_key

# Environment Variables
STUDENT_PROFILE_TABLE_NAME = os.getenv('STUDENT_PROFILE_TABLE_NAME')
JOB_RECOMMENDATIONS_TABLE_NAME = os.getenv('JOB_RECOMMENDATIONS_TABLE_NAME')
AWS_REGION = os.getenv('AWS_REGION')

def sanitize_email_for_actor_id(email: str) -> str:
    """
    Global sanitization function for email to actor_id conversion.

    This function is used consistently across the entire application:
    - JobSearchAgent for actor_id creation
    - DynamoDB functions for database keys
    - Memory namespaces for AWS Bedrock compatibility

    Args:
        email: Original email address

    Returns:
        Sanitized email safe for AWS Bedrock Agent Core
    """
    if not email:
        return ""

    # Replace any character not in allowed set with underscore
    sanitized = ''.join('_' if c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/*' else c for c in email)
    # Fix consecutive colons
    sanitized = sanitized.replace('::', ':_')

    return sanitized

class StudentProfile(BaseModel):
    """Student profile information for storing in DynamoDB."""
    email: str = Field(..., description="Student's email address")
    opt_in_status: bool = Field(..., description="Whether the student has opted in to receive notifications")

@tool
def get_student_profile(email: str) -> Dict[str, Any]:
    """
    Check if a student profile exists in DynamoDB based on email address.

    Use this tool to verify if a student has a profile in the system.

    Args:
        email: Student's email address (e.g., "student@university.edu")

    Returns:
        Dictionary indicating whether the profile exists
    """
    try:
        # VALIDATE email parameter
        try:
            email = validate_email(email)
        except ValueError as e:
            return {
                "exists": False,
                "message": f"Invalid email: {str(e)}"
            }

        # Initialize DynamoDB client
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(STUDENT_PROFILE_TABLE_NAME)

        # Sanitize email to get the actor_id for database lookup using global function
        sanitized_actor_id = sanitize_email_for_actor_id(email)

        # Get the student profile directly using the primary key (actionID)
        response = table.get_item(Key={'actionID': sanitized_actor_id})

        item = response.get('Item')

        if not item:
            return {
                "exists": False,
                "message": f"No profile found for email: {email}"
            }

        stored_email = item.get('email', email)  # Fallback to provided email if not stored

        return {
            "exists": True,
            "email": stored_email,
            "message": "Student profile found"
        }
    except Exception as e:
        return {
            "exists": False,
            "error": True,
            "message": f"Error retrieving student profile: {str(e)}"
        }

@tool
def save_job_recommendations(email: str, job_category: str, jobInformation: list) -> Dict[str, Any]:
    """
    Save job recommendations for a user in DynamoDB.

    This tool stores job recommendations with the following structure:
    - userJobKey: "email#job_category" (e.g., "john@gmail.com#software-engineer")
    - createdAt: ISO timestamp when recommendation was saved
    - jobInformation: List of structured job data objects

    Args:
        email: User's email address
        job_category: Job category/type (e.g., "software-engineer", "data-scientist")
        jobInformation: List of job information objects containing structured job data

    Returns:
        Status information about the database operation
    """
    try:
        # VALIDATE all inputs
        try:
            email = validate_email(email)
            job_category = validate_job_category(job_category)
            job_information = validate_job_information(jobInformation)
        except ValueError as e:
            return {
                "success": False,
                "message": f"Validation error: {str(e)}"
            }

        # Initialize DynamoDB client
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(JOB_RECOMMENDATIONS_TABLE_NAME)

        # Create and validate composite partition key
        user_job_key = validate_user_job_key(email, job_category)

        # Generate timestamp for sort key
        from datetime import datetime, timezone
        created_at = datetime.now(timezone.utc).isoformat() + 'Z'  # ISO format with Z suffix

        # Prepare item for DynamoDB
        item = {
            'userJobKey': user_job_key,              # ✅ Validated
            'createdAt': created_at,                 # ✅ System-generated
            'email': email,                          # ✅ Validated
            'jobCategory': job_category,             # ✅ Validated
            'jobInformation': job_information,       # ✅ Validated
            'sentToUser': False                      # ✅ Hardcoded
        }

        # Insert into DynamoDB using boto3 (prevents injection)
        table.put_item(Item=item)

        return {
            "success": True,
            "message": f"Job recommendations saved successfully for {email}",
            "userJobKey": user_job_key,
            "createdAt": created_at,
            "jobInformation": job_information,
            "sentToUser": False
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Error saving job recommendations: {str(e)}"
        }

@tool
def get_job_recommendations(email: str, job_category: str = None, limit: int = 10) -> Dict[str, Any]:
    """
    Retrieve job recommendations for a user from DynamoDB.

    Args:
        email: User's email address
        job_category: Optional job category filter (e.g., "software-engineer")
        limit: Maximum number of recommendations to return (default: 10)

    Returns:
        List of job recommendations for the user
    """
    try:
        # VALIDATE inputs
        try:
            email = validate_email(email)
            if job_category:
                job_category = validate_job_category(job_category)
        except ValueError as e:
            return {
                "success": False,
                "message": f"Validation error: {str(e)}",
                "recommendations": []
            }

        # Initialize DynamoDB client
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(JOB_RECOMMENDATIONS_TABLE_NAME)

        if job_category:
            # Query for specific job category
            user_job_key = f"{email}#{job_category}"

            response = table.query(
                KeyConditionExpression=boto3.dynamodb.conditions.Key('userJobKey').eq(user_job_key),
                ScanIndexForward=False,  # Most recent first
                Limit=limit
            )
        else:
            # Query for all job categories for this user
            # This requires a GSI with email as partition key
            # For now, we'll scan with filter (less efficient but works)
            response = table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr('email').eq(email),
                Limit=limit
            )

            # Sort by createdAt descending (most recent first)
            items = response.get('Items', [])
            items.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
            response['Items'] = items[:limit]

        items = response.get('Items', [])

        return {
            "success": True,
            "count": len(items),
            "recommendations": items,
            "message": f"Found {len(items)} job recommendations"
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Error retrieving job recommendations: {str(e)}",
            "recommendations": []
        }


