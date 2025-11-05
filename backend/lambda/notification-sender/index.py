"""
COMMUNICATION BATCH PROCESS - EMAIL NOTIFICATIONS
================================================
Sends daily job recommendation emails to all users with job recommendations every morning at 9 AM.

Simple workflow:
1. Get job recommendations from DynamoDB table
2. Send personalized emails to all users with job recommendations
3. Use environment variables for all configuration
"""

import json
import boto3
import os
from boto3.dynamodb.conditions import Attr
from email_template import generate_html_email, generate_text_email

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

def validate_boolean(value: any, field_name: str) -> bool:
    """Validate boolean values"""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        if value.lower() in ['true', '1', 'yes']:
            return True
        if value.lower() in ['false', '0', 'no']:
            return False
    raise ValueError(f"{field_name} must be a boolean value")

def validate_phone_number(phone: str) -> str:
    """Validate phone number format"""
    if not phone or not isinstance(phone, str):
        return "N/A"
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        return f"+1{digits}"
    elif len(digits) == 11 and digits[0] == '1':
        return f"+{digits}"
    else:
        return "N/A"

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')
# AWS End User Messaging SMS Voice v2 client
sms_voice_v2 = boto3.client('pinpoint-sms-voice-v2')

def lambda_handler(event, context):
    """Send daily job recommendations to opted-in users via their preferred communication method"""
    
    try:
        # Get configuration from environment variables (no hardcoding)
        job_recommendations_table_name = os.environ.get('JOB_RECOMMENDATIONS_TABLE_NAME')
        student_profile_table_name = os.environ.get('STUDENT_PROFILE_TABLE_NAME')
        sender_email = os.environ.get('SENDER_EMAIL')
        
        if not all([job_recommendations_table_name, student_profile_table_name, sender_email]):
            raise ValueError("Missing required environment variables")
        
        print(f"📧 Starting notification process...")
        
        # Get tables
        job_table = dynamodb.Table(job_recommendations_table_name)
        profile_table = dynamodb.Table(student_profile_table_name)
        
        # Step 1: Scan student profile table for opted-in users
        print(f"🔍 Scanning student profiles for opted-in users...")
        profile_response = profile_table.scan(
            FilterExpression=Attr('optInStatus').eq(True)
        )
        
        opted_in_users = profile_response['Items']
        print(f"📊 Found {len(opted_in_users)} opted-in users")
        
        if not opted_in_users:
            return {
                'statusCode': 200,
                'body': json.dumps('No opted-in users found')
            }
        
        # Step 2: Get all unsent job recommendations
        print(f"🔍 Scanning for unsent job recommendations...")
        job_response = job_table.scan(
            FilterExpression=Attr('sentToUser').eq(False)
        )
        
        unsent_jobs = job_response['Items']
        print(f"📊 Found {len(unsent_jobs)} unsent job recommendations")
        
        if not unsent_jobs:
            return {
                'statusCode': 200,
                'body': json.dumps('No unsent job recommendations')
            }
        
        # Group unsent jobs by email and job category WITH VALIDATION
        jobs_by_user = {}
        for job in unsent_jobs:
            email = job.get('email')
            job_category = job.get('jobCategory', 'general')

            # VALIDATE job data before processing
            try:
                validated_email = validate_email(email) if email else None
                validated_job_category = validate_string(job_category, 'jobCategory', 0, 100) if job_category else 'general'

                if validated_email:
                    if validated_email not in jobs_by_user:
                        jobs_by_user[validated_email] = {}
                    if validated_job_category not in jobs_by_user[validated_email]:
                        jobs_by_user[validated_email][validated_job_category] = []
                    jobs_by_user[validated_email][validated_job_category].append(job)
            except ValueError as e:
                print(f"Invalid job data: email={email}, category={job_category}, error={str(e)} - skipping")
        
        # Step 3: Process notifications for opted-in users with unsent jobs
        email_sent_count = 0
        sms_sent_count = 0
        failed_count = 0
        
        for user_profile in opted_in_users:
            user_email = user_profile.get('email')
            communication_method = user_profile.get('communicationMethod', 'email')
            phone = user_profile.get('phone')

            # VALIDATE user profile data before processing
            try:
                validated_email = validate_email(user_email) if user_email else None
                validated_communication_method = validate_string(communication_method, 'communicationMethod', 0, 20)
                validated_phone = validate_phone_number(phone) if phone else None
                validated_opt_in = validate_boolean(user_profile.get('optInStatus', False), 'optInStatus')

                # Skip if invalid data or not opted in
                if not validated_email or not validated_opt_in:
                    print(f"Skipping invalid user profile: email={user_email}")
                    continue

                # Check if user has unsent jobs
                if validated_email not in jobs_by_user:
                    continue

            except ValueError as e:
                print(f"Invalid user profile data: email={user_email}, error={str(e)} - skipping")
                continue
            
            categories = jobs_by_user[validated_email]

            try:
                # Send notifications for each job category
                for job_category, jobs in categories.items():
                    # Send email if communication method is 'email' or 'both'
                    if validated_communication_method in ['email', 'both']:
                        try:
                            send_job_email(validated_email, jobs, user_profile, sender_email, job_category)
                            email_sent_count += 1
                            print(f"✅ Email sent to {validated_email} for {job_category} jobs")
                        except Exception as e:
                            print(f"❌ Failed to send email to {validated_email}: {str(e)}")
                            failed_count += 1

                    # Send SMS if communication method is 'phone' or 'both'
                    if validated_communication_method in ['phone', 'both'] and validated_phone and validated_phone != "N/A":
                        try:
                            validated_full_name = validate_string(user_profile.get('fullName', 'Job Seeker'), 'fullName', 0, 100)
                            send_sms_notification(validated_phone, validated_full_name, jobs, job_category, validated_email)
                            sms_sent_count += 1
                            print(f"✅ SMS sent to {validated_phone} for {validated_email}")
                        except Exception as e:
                            print(f"❌ Failed to send SMS to {validated_phone}: {str(e)}")
                            failed_count += 1

                    # Mark jobs as sent only after successful notification
                    if validated_communication_method in ['email', 'both'] or (validated_communication_method == 'phone' and validated_phone and validated_phone != "N/A"):
                        mark_jobs_as_sent(jobs, job_table)

            except Exception as e:
                failed_count += 1
                print(f"❌ Failed to process notifications for {validated_email}: {str(e)}")
        
        result = f'Sent {email_sent_count} emails, {sms_sent_count} SMS messages, {failed_count} failed'
        print(f"📊 {result}")
        
        return {
            'statusCode': 200,
            'body': json.dumps(result)
        }
        
    except Exception as e:
        error_msg = f"Error in notification sender: {str(e)}"
        print(f"❌ {error_msg}")
        return {
            'statusCode': 500,
            'body': json.dumps(error_msg)
        }

def mark_jobs_as_sent(job_recommendations, job_table):
    """Mark job recommendations as sent to user"""
    for rec in job_recommendations:
        try:
            # Update the sentToUser field to True
            job_table.update_item(
                Key={
                    'userJobKey': rec['userJobKey'],
                    'createdAt': rec['createdAt']
                },
                UpdateExpression='SET sentToUser = :sent',
                ExpressionAttributeValues={
                    ':sent': True
                }
            )
        except Exception as e:
            print(f"⚠️  Failed to mark job as sent: {str(e)}")

def send_sms_notification(phone, user_name='Job Seeker', job_recommendations=None, job_category=None, user_email=None):
    """Send SMS notification via AWS End User Messaging SMS Voice v2 with clickable link"""
    try:
        # Get environment variables
        origination_number = os.environ.get('SMS_ORIGINATION_NUMBER')

        if not origination_number:
            print("Error: SMS_ORIGINATION_NUMBER environment variable not set. Please configure your verified phone number.")
            return

        print(f"Sending SMS to: {phone} from: {origination_number}")

        # Get first name for personalization
        first_name = user_name.split()[0] if user_name and user_name != 'Job Seeker' else 'there'

        # Generate clickable link if we have job recommendations
        link_text = ""
        if job_recommendations and len(job_recommendations) > 0:
            # Get the first job's parameters for the link
            first_job = job_recommendations[0]
            user_job_key = first_job.get('userJobKey')
            created_at = first_job.get('createdAt')

            if user_job_key and created_at:
                # URL encode the parameters
                from urllib.parse import quote
                encoded_user_job_key = quote(user_job_key)
                encoded_created_at = quote(created_at)

                # Generate the link to chatbot page with parameters
                base_url = os.environ.get('AMPLIFY_APP_URL', 'https://your-amplify-app-url.com')
                link_url = f"{base_url}/chatbot?userJobKey={encoded_user_job_key}&createdAt={encoded_created_at}"

                # Display category name nicely
                category_display = job_category.replace('-', ' ').title() if job_category else 'Job'

                link_text = f" View your {len(job_recommendations)} new {category_display} recommendations: {link_url}"

        # Add opt-out link at the end (unsubscribe from all only)
        optout_text = ""
        if user_email:
            from urllib.parse import quote
            base_url = os.environ.get('AMPLIFY_APP_URL', 'https://your-amplify-app-url.com')
            encoded_email = quote(user_email)
            optout_url = f"{base_url}/unsubscribe?email={encoded_email}&action=all"
            optout_text = f" To unsubscribe: {optout_url}"

        # Prepare SMS parameters
        sms_params = {
            'DestinationPhoneNumber': phone,
            'OriginationIdentity': origination_number,
            'MessageBody': f'Hi {first_name}! Your daily job recommendations are ready based on your preferences.{link_text}{optout_text}',
            'MessageType': 'PROMOTIONAL'  # Can be PROMOTIONAL or TRANSACTIONAL
        }

        # Send SMS using SMS Voice v2
        response = sms_voice_v2.send_text_message(**sms_params)

        print(f"SMS sent to {phone}. Message ID: {response.get('MessageId', 'N/A')}")

    except Exception as e:
        print(f"Failed to send SMS to {phone} via SMS Voice v2: {str(e)}")

def send_job_email(email, job_recommendations, user_profile, sender_email, job_category):
    """Send email notifications using templates"""

    # Get user's name for greeting from fullName field
    user_name = user_profile.get('fullName', 'Job Seeker')
    first_name = user_name.split()[0] if user_name and user_name != 'Job Seeker' else 'there'

    # Create email subject with job category (no count)
    category_display = job_category.replace('-', ' ').title() if job_category != 'general' else 'Job'
    subject = f"🎯 New {category_display} Recommendations for You!"

    # Generate email content using templates with opt-out links
    # Pass category_display as category_for_unsubscribe so the URL uses "Software Engineer" not "software-engineer"
    html_content = generate_html_email(first_name, category_display, job_recommendations, email, job_category, category_display)
    text_content = generate_text_email(first_name, category_display, job_recommendations, email, job_category, category_display)

    # Send email via SES
    ses.send_email(
        Source=sender_email,
        Destination={'ToAddresses': [email]},
        Message={
            'Subject': {'Data': subject},
            'Body': {
                'Text': {'Data': text_content},
                'Html': {'Data': html_content}
            }
        }
    )
