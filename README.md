# AI-Powered Job Search Assistant

A comprehensive chatbot application that provides intelligent job search and career guidance for students, powered by AWS Bedrock AgentCore and cutting-edge AI technologies.

## Index

| Description | Link |
|-------------|------|
| Overview | [Overview](#overview) |
| Architecture | [Architecture](#architecture-diagram) |
| Detailed Architecture | [Detailed Architecture](docs/ARCHITECTURE.MD) |
| User Flow | [User Flow](docs/USERFLOW.md) |
| SMS Prerequisites | [SMS Prerequisites](docs/SMS_PREREQUISITES.md) |
| Deployment | [Deployment](docs/DEPLOYMENT.MD) |
| Post-Deployment Setup | [Post-Deployment Setup](docs/POST_DEPLOYMENT_SETUP.md) |
| Usage | [Usage](#usage) |
| Infrastructure | [Infrastructure](docs/INFRASTRUCTURE.MD) |
| License | [License](#license) |

## Overview

This application combines natural language processing capabilities with intelligent job matching to deliver accurate, context-aware responses to student queries. Built on a serverless architecture with real-time communication, secure file management, and automated daily job recommendations.

### Key Features
- **Multi-Agent AI System** powered by AWS Bedrock with Claude 4.5 Sonnet
- **AgentCore Memory Integration** for cross-session conversation continuity
- **Automated Daily Job Recommendations** via email and SMS
- **AI Resume Parsing** with personalized job matching
- **Real-time Chat Interface** with streaming responses
- **Intelligent Job Fit Analysis** using semantic search and AI models

## Architecture Diagram

![Job Search Architecture Diagram](docs/JOB%20SEARCH%20ARCHITECTURE%20DIAGRAM.png)

The application implements a serverless, event-driven architecture with a multi-agent AI system at its core, combining real-time user interactions with automated batch processing for job matching.

For a detailed deep dive into the architecture, including core principles, component interactions, data flow, security, and implementation details, see [docs/ARCHITECTURE.MD](docs/ARCHITECTURE.MD).

## User Flow

For a detailed overview of the user journey and application workflow, including diagrams and step-by-step user interactions, see [docs/USERFLOW.md](docs/USERFLOW.md).

## Demo Video
*[Demo video link will be added here]*

## Deployment

For detailed deployment instructions, including prerequisites and step-by-step guides, see [docs/DEPLOYMENT.MD](docs/DEPLOYMENT.MD).

## Usage

For detailed post-deployment setup and usage instructions, including configuration steps and how to use the application, see [docs/POST_DEPLOYMENT_SETUP.md](docs/POST_DEPLOYMENT_SETUP.md).

## Infrastructure

For a detailed overview of the application infrastructure, including component interactions, AWS services, and data flow, see [docs/INFRASTRUCTURE.MD](docs/INFRASTRUCTURE.MD).

## License

See LICENSE file for details.
