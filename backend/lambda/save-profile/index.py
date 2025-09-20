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
        print(f"🔍 Detected HTTP method: {http_method}")

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
                    'optInStatus': item.get('optInStatus', False),
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
            print("🚀 POST request received for profile save")
            print(f"📨 Full event keys: {list(event.keys())}")

            # Handle POST request - save profile
            # Extract parsed resume data from Function URL payload
            if 'body' not in event:
                print("❌ No body in request")
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'error': 'Request body is required'
                    })
                }

            print(f"📨 Raw body: {event['body'][:500]}...")  # First 500 chars to avoid huge logs
            parsed_data = json.loads(event['body'])['parsed_data']
            print(f"📨 Parsed data keys: {list(parsed_data.keys()) if parsed_data else 'None'}")
            print(f"📨 preferredJobRole in parsed_data: {parsed_data.get('preferredJobRole', 'NOT_FOUND')}")

            # Validate required fields
            if not parsed_data.get('email'):
                raise ValueError("Email is required")

            print(f"🔍 Parsed data: {json.dumps(parsed_data)}")
            # Use email as actionID with underscore replacement
            email = parsed_data.get('email')
            sanitized = ''.join('_' if c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/*' else c for c in email)
            # Fix consecutive colons
            action_id = sanitized.replace('::', ':_')

            try:
                print(f"🔍 Checking for existing profile with actionID: {action_id}")

                # Check if profile already exists
                existing_response = table.get_item(Key={'actionID': action_id})
                existing_item = existing_response.get('Item', {}) if 'Item' in existing_response else {}

                print(f"🔍 Existing item found: {'Yes' if existing_item else 'No'}")
                print(f"🔍 Existing item keys: {list(existing_item.keys()) if existing_item else 'None'}")

                # Merge existing data with new data (preserve fields not in parsed_data)
                merged_item = {
                    **existing_item,  # Keep all existing fields
                    'actionID': action_id,
                    'email': email,
                    'fullName': parsed_data.get('fullName', existing_item.get('fullName', '')),
                    'location': parsed_data.get('location', existing_item.get('location', '')),
                    'headline': parsed_data.get('headline', existing_item.get('headline', '')),
                    'aboutMe': parsed_data.get('aboutMe', existing_item.get('aboutMe', '')),
                    'education': parsed_data.get('education', existing_item.get('education', '')),
                    'experience': parsed_data.get('experience', existing_item.get('experience', '')),
                    'phone': parsed_data.get('phone', existing_item.get('phone', '')),
                'preferredJobRole': parsed_data.get('preferredJobRole', existing_item.get('preferredJobRole', '')),
                'linkedin': parsed_data.get('linkedin', existing_item.get('linkedin', '')),
                'optInStatus': parsed_data.get('optInStatus', existing_item.get('optInStatus', False)),
                'communicationMethod': parsed_data.get('communicationMethod', existing_item.get('communicationMethod', '')),
                    'timestamp': datetime.utcnow().isoformat()
                }

                print(f"💾 About to save merged item with preferredJobRole: {merged_item.get('preferredJobRole', 'NOT_SET')}")
                print(f"💾 Full merged item keys: {list(merged_item.keys())}")

                # Save to DynamoDB
                response = table.put_item(Item=merged_item)
                print(f"💾 DynamoDB put_item response: {response}")
                print("✅ Item successfully saved to DynamoDB")

            except Exception as save_error:
                print(f"❌ Error during save operation: {str(save_error)}")
                print(f"❌ Error type: {type(save_error).__name__}")
                import traceback
                print(f"❌ Full traceback: {traceback.format_exc()}")
                raise save_error

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
        print(f"❌ Error type: {type(e).__name__}")
        import traceback
        print(f"❌ Full traceback: {traceback.format_exc()}")

        # Try to determine if this is a DynamoDB permissions issue
        if 'dynamodb' in str(e).lower() or 'access' in str(e).lower():
            print("🚨 This might be a DynamoDB permissions issue!")

        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Failed to process profile request'
            })
        }