# Student Career Services Flow

## Overview

This diagram shows how students interact with our AI-powered career services system, featuring two specialized assistants and automated daily job matching.

## Student Experience Flows

### 1. Job Search Experience (Blue)
**For students seeking employment opportunities**
- **Job Search Assistant**: Helps students find part-time jobs, full-time positions, and internships
- Students can upload resumes (optional) and answer preference questions
- System searches job database for personalized matches
- Students receive tailored job recommendations
- Option to sign up for daily job updates via email

### 2. Career Exploration Experience (Purple)
**For students exploring career paths and academic majors**
- **Career Exploration Assistant**: Guides students through career discovery process
- Students take career assessments and explore different paths
- System provides insights on career options and academic majors
- Students receive personalized career recommendations

### 3. Daily Notification System (Orange)
**Automated system for ongoing job matching**
- Runs automatically every day
- Finds new job opportunities for students who opted in
- Sends personalized job updates via email
- Keeps students informed of relevant opportunities

## Our AI Assistants

- **Job Search Assistant**: Specializes in matching students with employment opportunities based on their skills, experience, and preferences
- **Career Exploration Assistant**: Helps students discover career paths and academic majors through assessments and guided exploration

## Files
- `user_flow.dot` - Graphviz source file
- `user_flow.png` - Generated flow diagram image

## Generate Image
```bash
dot -Tpng user_flow.dot -o user_flow.png
```