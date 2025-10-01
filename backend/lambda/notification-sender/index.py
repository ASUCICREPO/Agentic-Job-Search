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
from datetime import datetime, timedelta
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
from email_template import generate_html_email, generate_text_email

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')
# AWS End User Messaging SMS Voice v2 client
sms_voice_v2 = boto3.client('pinpoint-sms-voice-v2')

def lambda_handler(event, context):
    """Send daily job recommendation emails to all users with job recommendations"""
    
    try:
        # Get configuration from environment variables (no hardcoding)
        job_recommendations_table_name = os.environ.get('JOB_RECOMMENDATIONS_TABLE_NAME')
        student_profile_table_name = os.environ.get('STUDENT_PROFILE_TABLE_NAME')
        sender_email = os.environ.get('SENDER_EMAIL')
        
        if not all([job_recommendations_table_name, student_profile_table_name, sender_email]):
            raise ValueError("Missing required environment variables")
        
        print(f"📧 Starting daily email notifications...")
        
        # Get job recommendations table
        job_table = dynamodb.Table(job_recommendations_table_name)
        profile_table = dynamodb.Table(student_profile_table_name)
        
        # Get recent job recommendations (last 24 hours)
        yesterday = datetime.utcnow() - timedelta(hours=24)
        yesterday_iso = yesterday.isoformat() + 'Z'
        
        response = job_table.scan(
            FilterExpression=Attr('createdAt').gte(yesterday_iso)
        )
        
        recommendations = response['Items']
        print(f"📊 Found {len(recommendations)} recent job recommendations")
        
        if not recommendations:
            return {
                'statusCode': 200,
                'body': json.dumps('No recent job recommendations to send')
            }
        
        # Group recommendations by user email and job category (only unsent ones)
        user_jobs_by_category = {}
        for rec in recommendations:
            email = rec.get('email')
            job_category = rec.get('jobCategory', 'general')
            sent_to_user = rec.get('sentToUser', False)
            
            # Only process if email exists and not yet sent to user
            if email and '@' in email and not sent_to_user:
                if email not in user_jobs_by_category:
                    user_jobs_by_category[email] = {}
                if job_category not in user_jobs_by_category[email]:
                    user_jobs_by_category[email][job_category] = []
                user_jobs_by_category[email][job_category].append(rec)
        
        # Send separate emails for each user and job category
        sent_count = 0
        failed_count = 0
        
        for email, categories in user_jobs_by_category.items():
            try:
                # Get user profile for personalization - search by email field
                profile_response = profile_table.scan(
                    FilterExpression=Attr('email').eq(email)
                )
                
                user_profile = {}
                if profile_response['Items']:
                    user_profile = profile_response['Items'][0]
                
                # Send separate email for each job category
                for job_category, jobs in categories.items():
                    send_job_email(email, jobs, user_profile, sender_email, job_category)
                    
                    # Mark all job recommendations as sent after successful email
                    mark_jobs_as_sent(jobs, job_table)
                    
                    sent_count += 1
                    print(f"✅ Email sent to {email} for {job_category} jobs")
                    
            except Exception as e:
                failed_count += 1
                print(f"❌ Failed to send email to {email}: {str(e)}")
        
        result = f'Sent {sent_count} emails, {failed_count} failed'
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

def send_sms_notification(phone):
    """Send SMS notification via AWS End User Messaging SMS Voice v2"""
    try:
        # Get environment variables
        origination_number = os.environ.get('SMS_ORIGINATION_NUMBER')

        if not origination_number:
            print("Error: SMS_ORIGINATION_NUMBER environment variable not set. Please configure your verified phone number.")
            return

        print(f"Sending SMS to: {phone} from: {origination_number}")

        # Prepare SMS parameters (simplified - no pool or config set needed for basic testing)
        sms_params = {
            'DestinationPhoneNumber': phone,
            'OriginationIdentity': origination_number,
            'MessageBody': 'Your daily job recommendations are ready! Check your career portal for personalized opportunities.',
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

    # Generate email content using templates
    html_content = generate_html_email(first_name, category_display, job_recommendations)
    text_content = generate_text_email(first_name, category_display, job_recommendations)

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
