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
TABLE_NAME = os.getenv('DYNAMO_TABLE_NAME')
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
    Check if a student profile already exists in DynamoDB.

    Use this tool to retrieve student profile information based on their email address.
    This tool is useful to check if a student has already registered their email and
    notification preferences.

    Args:
        email: Student's email address (e.g., "student@university.edu")

    Returns:
        Dictionary containing the student profile information if found, or a message
        indicating the profile was not found.
    """
    try:
        # Initialize DynamoDB client
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(TABLE_NAME)

        # Sanitize email to get the actor_id for database lookup using global function
        sanitized_actor_id = sanitize_email_for_actor_id(email)

        # Query for existing records with sanitized actor_id
        response = table.scan(
            FilterExpression=boto3.dynamodb.conditions.Key('actionID').eq(sanitized_actor_id)
        )

        items = response.get('Items', [])

        if not items:
            return {
                "exists": False,
                "message": f"No profile found for email: {email}"
            }

        # Get the student profile (there should only be one record per actionID)
        # Since actionID is now the partition key, we just take the first item
        most_recent = items[0]

        opt_in_status = most_recent.get('optInStatus', False)
        notification_method = most_recent.get('notificationMethod', 'email')
        stored_email = most_recent.get('email', email)  # Fallback to provided email if not stored

        return {
            "exists": True,
            "email": stored_email,
            "opt_in_status": opt_in_status,
            "notification_method": notification_method,
            "message": "Student profile found"
        }
    except Exception as e:
        return {
            "exists": False,
            "error": True,
            "message": f"Error retrieving student profile: {str(e)}"
        }

@tool
def save_student_profile(email: str, opt_in_status: bool, notification_method: str = "email", update_existing: bool = True) -> Dict[str, Any]:
    """
    Save or update student profile information in DynamoDB.

    Use this tool to store student email and notification preferences. This tool should be used when a student
    provides their email address and indicates whether they want to receive notifications about job opportunities.

    After collecting the email address from the user, use this tool to store their information.

    The tool will create a new record or update an existing one based on the sanitized email (actor_id).

    Args:
        email: Student's email address (e.g., "student@university.edu")
        opt_in_status: Whether the student has opted in to receive notifications (true/false)
        notification_method: How the student prefers to be notified - "email", "phone", or "both" (default: "email")
        update_existing: Whether to update if a record with this email already exists (default: True)

    Returns:
        Status information about the database operation
    """
    try:
        # Initialize DynamoDB client
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(TABLE_NAME)

        # Sanitize email to create the actor_id using global function
        sanitized_actor_id = sanitize_email_for_actor_id(email)

        # Check if this record already exists, if update_existing is False, we'll inform about it
        existing_record = False

        if update_existing:
            # Check for existing records with sanitized actor_id
            response = table.scan(
                FilterExpression=boto3.dynamodb.conditions.Key('actionID').eq(sanitized_actor_id)
            )

            if response.get('Items', []):
                existing_record = True

        # Validate notification_method value
        valid_methods = ["email", "phone", "both"]
        validated_method = notification_method.lower() if notification_method.lower() in valid_methods else "email"

        # Prepare item for DynamoDB - using sanitized actor_id and storing original email
        item = {
            'actionID': sanitized_actor_id,  # Sanitized email as primary key
            'email': email,  # Original email stored separately
            'optInStatus': opt_in_status,
            'notificationMethod': validated_method
        }

        # Put item in DynamoDB
        table.put_item(Item=item)

        if existing_record:
            return {
                "success": True,
                "message": "Student profile updated successfully",
                "updated": True,
                "actor_id": sanitized_actor_id,
                "email": email,
                "opt_in_status": opt_in_status,
                "notification_method": validated_method
            }
        else:
            return {
                "success": True,
                "message": "New student profile saved successfully",
                "updated": False,
                "actor_id": sanitized_actor_id,
                "email": email,
                "opt_in_status": opt_in_status,
                "notification_method": validated_method
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error saving student profile: {str(e)}"
        }

@tool
def save_job_recommendations(email: str, job_category: str, job_ids: list, sent_via: str = "livesearch") -> Dict[str, Any]:
    """
    Save job recommendations for a user in DynamoDB.

    This tool stores job recommendations with the following structure:
    - userJobKey: "email#job_category" (e.g., "john@gmail.com#software-engineer")
    - createdAt: ISO timestamp when recommendation was saved
    - jobIds: Array of job IDs that were recommended (preferably 1 job per search)
    - sentVia: How the recommendation was sent ("livesearch" or "batch")
    - sentToUser: Boolean indicating if notification was sent (auto-true for "livesearch")

    Args:
        email: User's email address
        job_category: Job category/type (e.g., "software-engineer", "data-scientist")
        job_ids: List of job IDs that were recommended (preferably 1 job)
        sent_via: How the recommendation was sent ("livesearch" or "batch", default: "livesearch")

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

        if not job_ids or not isinstance(job_ids, list):
            return {
                "success": False,
                "message": "Job IDs must be provided as a non-empty list"
            }

        # Validate sent_via parameter
        if sent_via not in ["livesearch", "batch"]:
            return {
                "success": False,
                "message": "sent_via must be either 'livesearch' or 'batch'"
            }

        # Initialize DynamoDB client
        dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
        table = dynamodb.Table(JOB_RECOMMENDATIONS_TABLE_NAME)

        # Create composite partition key
        user_job_key = f"{email}#{job_category}"

        # Generate timestamp for sort key
        from datetime import datetime
        created_at = datetime.utcnow().isoformat() + 'Z'  # ISO format with Z suffix

        # Automatically set sentToUser based on sentVia
        sent_to_user = sent_via == "livesearch"

        # Prepare item for DynamoDB
        item = {
            'userJobKey': user_job_key,
            'createdAt': created_at,
            'email': email,
            'jobCategory': job_category,
            'jobIds': job_ids,
            'sentVia': sent_via,
            'sentToUser': sent_to_user
        }

        # Put item in DynamoDB
        table.put_item(Item=item)

        return {
            "success": True,
            "message": f"Job recommendations saved successfully for {email}",
            "userJobKey": user_job_key,
            "createdAt": created_at,
            "jobIds": job_ids,
            "sentVia": sent_via,
            "sentToUser": sent_to_user
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
