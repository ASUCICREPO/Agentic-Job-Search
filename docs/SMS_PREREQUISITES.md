# SMS Prerequisites: 10DLC Phone Number Setup

For SMS notifications to work properly, you need to set up a 10DLC (10-Digit Long Code) phone number in your AWS account using End User Messaging.

## Prerequisites for 10DLC Setup
- You must have an approved 10DLC registered brand
- You must have an approved 10DLC registered campaign
- Access to AWS End User Messaging SMS console

## Request a 10DLC Phone Number

1. **Open AWS End User Messaging SMS Console**:
   - In the AWS Console, search for "End User Messaging SMS"
   - Select the service from the results

2. **Navigate to Phone Numbers**:
   - In the left sidebar, click on "Phone numbers"
   - Click "Request originator"

3. **Configure Message Destination**:
   - Choose "United States (US)" as the message destination country

4. **Set Up Messaging Use Case**:
   - Select your estimated monthly message volume
   - Choose your company headquarters location

5. **Select Originator Type and Associate**:
   - Choose "10DLC" as your originator type
   - Associate with your registered brand
   - Associate with your registered campaign

6. **Configure Resource Policy**:
   - Set up resource policy to share with services like Amazon Pinpoint or SNS
   - This allows your Lambda functions to use the phone number for SMS

7. **Submit Request**:
   - Review all settings
   - Submit your phone number request

8. **Complete Registration**:
   - Enter a registration form name
   - Choose "Begin registration"
   - Wait for approval (this can take several business days)

## Important Notes
- **Your phone number cannot send messages until registration is approved**
- The approval process typically takes 2-5 business days
- Keep track of your phone number ARN for use in Lambda environment variables
- You may need to update your Lambda functions with the approved phone number once registration is complete

## Update Lambda with Phone Number
Once your 10DLC number is approved:
1. Navigate to your SMS-related Lambda functions
2. Update environment variables with the new phone number
3. Test SMS functionality to ensure proper operation