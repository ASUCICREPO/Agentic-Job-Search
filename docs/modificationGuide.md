# Project Modification Guide

This guide provides guidance and instructions on how to modify and extend the project.

## Expanding Agentic Capability

The solution uses an AI agentic system for job search and career guidance, where the AI model itself identifies relevant job opportunities from the knowledge bases to match user profiles and preferences. This pattern is customizable and can be expanded by storing job search criteria and matching parameters in a DynamoDB table, from where it can be extended to include various career services from internship matching to skill assessments as well.

The job matching criteria are currently defined in the AgentCore prompts in `backend/JobSearchAgent/StrandsAgents.py`. This can be stored in a DynamoDB table for easy management and updates.

The AI model can be switched by updating model Id in the `create_bedrock_model()` function.

The job selection process can be enhanced by implementing more sophisticated metadata extraction techniques from job postings and resume parsing.

## Feedback Loop to improve the system as it is used more

The AI system that analyzes job matches and provides career recommendations can be provided with feedback on job recommendation quality, as this can be used to steer the model into better matching and focusing on particular aspects of job fit analysis. As the system is used, this feedback can be used to guide the model recommendations in that manner and can be an easy system to improve by simply creating an API and lambda function to update the database table.

The feedback loop can be implemented by creating a new API endpoint that accepts feedback data and updates the relevant job matching criteria in the DynamoDB table.

## Frontend Modifications

The code for the frontend can be found in the frontend directory. Key modifications can be done by updating the relevant React components and services to integrate with the new API endpoints and data structures.

## Conclusion

By following this modification guide, developers can enhance the AI-driven job search system to better meet user needs and improve overall efficiency. This solution can be extended to accommodate additional career services and feedback mechanisms as required making it more robust and adaptable to changing requirements.