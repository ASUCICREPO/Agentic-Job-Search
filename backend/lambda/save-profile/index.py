import json
import boto3
import os
from typing import Dict, Any
from datetime import datetime

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Lambda function to save and retrieve student profile data from DynamoDB
    Supports both POST (save) and GET (retrieve) operations
    """

    try:
        table_name = os.environ.get('STUDENT_PROFILE_TABLE_NAME')
        if not table_name:
            raise ValueError("STUDENT_PROFILE_TABLE_NAME environment variable not set")

        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table(table_name)

        http_method = event.get('requestContext', {}).get('http', {}).get('method') or event.get('httpMethod', 'POST')

        if http_method == 'GET':
            # Handle GET request - retrieve profile by email
            email = event.get('queryStringParameters', {}).get('email') if event.get('queryStringParameters') else None

            if not email:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'error': 'Email parameter is required for GET request'
                    })
                }

            print(f"🔍 Retrieving profile for email: {email}")

            # Sanitize email for actionID lookup (same logic as save)
            sanitized = ''.join('_' if c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/*' else c for c in email)
            action_id = sanitized.replace('::', ':_')

            # Get item from DynamoDB
            response = table.get_item(Key={'actionID': action_id})

            if 'Item' in response:
                item = response['Item']
                print(f"✅ Profile found for email: {email}")

                # Return profile data (exclude internal fields)
                profile_data = {
                    'fullName': item.get('fullName', ''),
                    'location': item.get('location', ''),
                    'headline': item.get('headline', ''),
                    'aboutMe': item.get('aboutMe', ''),
                    'education': item.get('education', ''),
                    'experience': item.get('experience', ''),
                    'email': item.get('email', ''),
                    'phone': item.get('phone', ''),
                    'preferredJobRole': item.get('preferredJobRole', ''),
                    'linkedin': item.get('linkedin', ''),
                    'optinStatus': item.get('optinStatus', ''),
                    'communicationMethod': item.get('communicationMethod', '')
                }

                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': 'Profile retrieved successfully',
                        'profile': profile_data
                    })
                }
            else:
                print(f"❌ No profile found for email: {email}")
                return {
                    'statusCode': 404,
                    'body': json.dumps({
                        'message': 'Profile not found',
                        'profile': None
                    })
                }

        elif http_method == 'POST':
            # Handle POST request - save profile
            # Extract parsed resume data from Function URL payload
            if 'body' not in event:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'error': 'Request body is required'
                    })
                }

            parsed_data = json.loads(event['body'])['parsed_data']

            # Validate required fields
            if not parsed_data.get('email'):
                raise ValueError("Email is required")

            print(f"🔍 Parsed data: {json.dumps(parsed_data)}")
            # Use email as actionID with underscore replacement
            email = parsed_data.get('email')
            sanitized = ''.join('_' if c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/*' else c for c in email)
            # Fix consecutive colons
            action_id = sanitized.replace('::', ':_')

            # Create DynamoDB item
            item = {
                'actionID': action_id,
                'email': email,
                'fullName': parsed_data.get('fullName', ''),
                'location': parsed_data.get('location', ''),
                'headline': parsed_data.get('headline', ''),
                'aboutMe': parsed_data.get('aboutMe', ''),
                'education': parsed_data.get('education', ''),
                'experience': parsed_data.get('experience', ''),
                'phone': parsed_data.get('phone', ''),
                'preferredJobRole': parsed_data.get('preferredJobRole', ''),
                'linkedin': parsed_data.get('linkedin', ''),
                'optinStatus': parsed_data.get('optinStatus', ''),
                'communicationMethod': parsed_data.get('communicationMethod', ''),
                'notificationMethod': event.get('notification_method', 'email'),
                'timestamp': datetime.utcnow().isoformat()
            }

            print(f"💾 Putting item to DynamoDB: {json.dumps(item)}")
            table.put_item(Item=item)
            print("✅ Item successfully saved to DynamoDB")

            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Student profile saved successfully',
                    'action_id': action_id
                })
            }

        else:
            return {
                'statusCode': 405,
                'body': json.dumps({
                    'error': f'HTTP method {http_method} not supported'
                })
            }

    except Exception as e:
        print(f"❌ Error in save-profile Lambda: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Failed to process profile request'
            })
        }