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
    session_id: Optional[str] = Field(None, description="Session ID for the conversation")

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

        # Get the most recently added profile (highest session ID)
        # This assumes that the most recent session has the most up-to-date info
        most_recent = sorted(items, key=lambda x: x.get('sessionID', ''), reverse=True)[0]

        opt_in_status = most_recent.get('optInStatus', False)
        notification_method = most_recent.get('notificationMethod', 'email')
        stored_email = most_recent.get('email', email)  # Fallback to provided email if not stored

        return {
            "exists": True,
            "email": stored_email,
            "opt_in_status": opt_in_status,
            "notification_method": notification_method,
            "session_id": most_recent.get('sessionID', None),
            "message": "Student profile found"
        }
    except Exception as e:
        return {
            "exists": False,
            "error": True,
            "message": f"Error retrieving student profile: {str(e)}"
        }

@tool
def save_student_profile(email: str, opt_in_status: bool, notification_method: str = "email", session_id: Optional[str] = None, update_existing: bool = True) -> Dict[str, Any]:
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
        session_id: Optional session ID for the current conversation (if not provided, will use a default)
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

        current_session_id = session_id

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
            'sessionID': current_session_id,
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
                "session_id": current_session_id,
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
                "session_id": current_session_id,
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
