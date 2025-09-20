import json
import boto3
import os
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')
sns = boto3.client('sns')

def lambda_handler(event, context):
    """EventBridge triggered notification sender - sends daily notifications via SES/SNS"""
    table_name = os.environ['DYNAMODB_TABLE_NAME']
    
    table = dynamodb.Table(table_name)
    
    try:
        # Scan table for opted-in users
        response = table.scan(
            FilterExpression=Attr('optInStatus').eq(True)
        )
        
        sent_count = 0
        for item in response['Items']:
            communication_method = item.get('communicationMethod', 'email')

            # Handle multiple communication methods (comma-separated)
            methods = [method.strip() for method in communication_method.split(',') if method.strip()]

            for method in methods:
                if method == 'email':
                    email = item.get('email')
                    if email and '@' in email:
                        send_email_notification(email)
                        sent_count += 1
                elif method == 'phone':
                    phone = item.get('phone')
                    if phone:
                        send_sms_notification(phone)
                        sent_count += 1
        
        return {
            'statusCode': 200,
            'body': json.dumps(f'Sent {sent_count} daily notifications')
        }
        
    except Exception as e:
        print(f"Error sending notifications: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }

def send_email_notification(email):
    """Send email notification via SES"""
    try:
        sender_email = os.environ.get('SENDER_EMAIL', 'noreply@yourcareerservices.com')
        ses.send_email(
            Source=sender_email,
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': 'Your Daily Job Recommendations'},
                'Body': {
                    'Text': {'Data': 'Check out your personalized job recommendations for today!'},
                    'Html': {'Data': '<h1>Your Daily Job Recommendations</h1><p>Check out your personalized job recommendations for today!</p>'}
                }
            }
        )
        print(f"Email sent to {email}")
    except Exception as e:
        print(f"Failed to send email to {email}: {str(e)}")

def send_sms_notification(phone):
    """Send SMS notification via SNS"""
    try:
        sns.publish(
            PhoneNumber=phone,
            Message='Your daily job recommendations are ready! Check your career portal for personalized opportunities.'
        )
        print(f"SMS sent to {phone}")
    except Exception as e:
        print(f"Failed to send SMS to {phone}: {str(e)}")