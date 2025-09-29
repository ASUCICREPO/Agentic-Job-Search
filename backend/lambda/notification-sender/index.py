import json
import boto3
import os
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource('dynamodb')
ses = boto3.client('ses')
# AWS End User Messaging SMS Voice v2 client
sms_voice_v2 = boto3.client('pinpoint-sms-voice-v2')

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
    """Send SMS notification via AWS End User Messaging SMS Voice v2"""
    try:
        # Get environment variables
        origination_number = os.environ.get('SMS_ORIGINATION_NUMBER')
        configuration_set_name = os.environ.get('CONFIGURATION_SET_NAME')
        phone_pool_id = os.environ.get('PHONE_POOL_ID')

        if not origination_number:
            print("Error: SMS_ORIGINATION_NUMBER environment variable not set. Please configure your verified phone number.")
            print(f"Available env vars: PHONE_POOL_ID={phone_pool_id}, CONFIGURATION_SET_NAME={configuration_set_name}")
            return

        print(f"Sending SMS to: {phone} from: {origination_number}")
        print(f"Using pool: {phone_pool_id}, config set: {configuration_set_name}")

        # Prepare SMS parameters
        sms_params = {
            'DestinationPhoneNumber': phone,
            'OriginationIdentity': origination_number,
            'MessageBody': 'Your daily job recommendations are ready! Check your career portal for personalized opportunities.',
            'MessageType': 'PROMOTIONAL'  # Can be PROMOTIONAL or TRANSACTIONAL
        }

        # Add configuration set if provided
        if configuration_set_name:
            sms_params['ConfigurationSetName'] = configuration_set_name

        # Send SMS using SMS Voice v2
        response = sms_voice_v2.send_text_message(**sms_params)

        print(f"SMS sent to {phone}. Message ID: {response.get('MessageId', 'N/A')}")

    except Exception as e:
        print(f"Failed to send SMS to {phone} via SMS Voice v2: {str(e)}")