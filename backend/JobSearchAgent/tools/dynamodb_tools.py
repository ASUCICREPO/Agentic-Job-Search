#!/usr/bin/env python3
"""
DynamoDB tools for the Job Search Agent.
Contains functions for managing student profiles in DynamoDB.
"""

import os
import boto3
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from strands import tool

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
        # Validate email parameter
        if not email:
            return {
                "exists": False,
                "message": "Email is required"
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
        # Validate inputs
        if not email or not job_category:
            return {
                "success": False,
                "message": "Email and job category are required"
            }

        if not jobInformation or not isinstance(jobInformation, list):
            return {
                "success": False,
                "message": "Job information must be provided as a non-empty list"
            }

        # Initialize DynamoDB client
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(JOB_RECOMMENDATIONS_TABLE_NAME)

        # Create composite partition key
        user_job_key = f"{email}#{job_category}"

        # Generate timestamp for sort key
        from datetime import datetime
        created_at = datetime.utcnow().isoformat() + 'Z'  # ISO format with Z suffix

        # Prepare item for DynamoDB
        item = {
            'userJobKey': user_job_key,
            'createdAt': created_at,
            'email': email,
            'jobCategory': job_category,
            'jobInformation': jobInformation,
            'sentToUser': False  # Always false for batch processing
        }

        # Put item in DynamoDB
        table.put_item(Item=item)

        return {
            "success": True,
            "message": f"Job recommendations saved successfully for {email}",
            "userJobKey": user_job_key,
            "createdAt": created_at,
            "jobInformation": jobInformation,
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


