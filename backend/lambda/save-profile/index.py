import json
import boto3
import os
from typing import Dict, Any
from datetime import datetime, timezone

# Import shared validation functions from the utility module
from utils.validation import validate_email, validate_string, validate_boolean, validate_phone_number
def sanitize_email_for_actor_id(email: str) -> str:
    """
    Sanitize email for use as DynamoDB actionID.
    Replaces special characters with underscores for AWS Bedrock compatibility.
    """
    if not email:
        return ""
    sanitized = ''.join('_' if c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/*' else c for c in email)
    sanitized = sanitized.replace('::', ':_')
    return sanitized

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

            # VALIDATE email parameter
            try:
                email = validate_email(email)
            except ValueError as e:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'error': f'Invalid email: {str(e)}'
                    })
                }

            # Sanitize email for actionID lookup
            action_id = sanitize_email_for_actor_id(email)

            # Get item from DynamoDB
            response = table.get_item(Key={'actionID': action_id})

            if 'Item' in response:
                item = response['Item']
                print(f"✅ Profile found for email: {email}")

                # Return profile data with validation on retrieval
                profile_data = {
                    'fullName': validate_string(item.get('fullName', ''), 'fullName', 0, 100),
                    'location': validate_string(item.get('location', ''), 'location', 0, 100),
                    'headline': validate_string(item.get('headline', ''), 'headline', 0, 200),
                    'aboutMe': validate_string(item.get('aboutMe', ''), 'aboutMe', 0, 500),
                    'education': validate_string(item.get('education', ''), 'education', 0, 500),
                    'experience': validate_string(item.get('experience', ''), 'experience', 0, 2000),
                    'email': validate_email(item.get('email', email)),
                    'phone': validate_phone_number(item.get('phone', '')),
                    'preferredJobRole': validate_string(item.get('preferredJobRole', ''), 'preferredJobRole', 0, 200),
                    'linkedin': validate_string(item.get('linkedin', ''), 'linkedin', 0, 200),
                    'optInStatus': validate_boolean(item.get('optInStatus', False), 'optInStatus'),
                    'communicationMethod': validate_string(item.get('communicationMethod', 'email'), 'communicationMethod', 0, 20)
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

            print(f"🔍 Parsed data: {json.dumps(parsed_data)}")

            # VALIDATE all inputs before processing
            try:
                email = validate_email(parsed_data.get('email'))
                full_name = validate_string(parsed_data.get('fullName', ''), 'fullName', 2, 100)
                location = validate_string(parsed_data.get('location', ''), 'location', 0, 100)
                headline = validate_string(parsed_data.get('headline', ''), 'headline', 0, 200)
                about_me = validate_string(parsed_data.get('aboutMe', ''), 'aboutMe', 0, 500)
                education = validate_string(parsed_data.get('education', ''), 'education', 0, 500)
                experience = validate_string(parsed_data.get('experience', ''), 'experience', 0, 2000)
                phone = validate_phone_number(parsed_data.get('phone', ''))
                preferred_job_role = validate_string(parsed_data.get('preferredJobRole', ''), 'preferredJobRole', 0, 200)
                linkedin = validate_string(parsed_data.get('linkedin', ''), 'linkedin', 0, 200)
                opt_in_status = validate_boolean(parsed_data.get('optInStatus', False), 'optInStatus')
                communication_method = validate_string(parsed_data.get('communicationMethod', 'email'), 'communicationMethod', 0, 20)
            except ValueError as e:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'error': f'Validation error: {str(e)}'
                    })
                }

            # Sanitize email for actionID
            action_id = sanitize_email_for_actor_id(email)

            try:
                print(f"🔍 Checking for existing profile with actionID: {action_id}")

                # Check if profile already exists
                existing_response = table.get_item(Key={'actionID': action_id})
                existing_item = existing_response.get('Item', {}) if 'Item' in existing_response else {}

                print(f"🔍 Existing item found: {'Yes' if existing_item else 'No'}")
                print(f"🔍 Existing item keys: {list(existing_item.keys()) if existing_item else 'None'}")

                # Merge existing data with validated new data
                merged_item = {
                    'actionID': action_id,              # ✅ Sanitized
                    'email': email,                     # ✅ Validated
                    'fullName': full_name,              # ✅ Validated
                    'location': location,               # ✅ Validated
                    'headline': headline,               # ✅ Validated
                    'aboutMe': about_me,                # ✅ Validated
                    'education': education,             # ✅ Validated
                    'experience': experience,           # ✅ Validated
                    'phone': phone,                     # ✅ Validated
                    'preferredJobRole': preferred_job_role,  # ✅ Validated
                    'linkedin': linkedin,               # ✅ Validated
                    'optInStatus': opt_in_status,       # ✅ Validated
                    'communicationMethod': communication_method,  # ✅ Validated
                    'timestamp': datetime.now(timezone.utc).isoformat()    # ✅ System-generated
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