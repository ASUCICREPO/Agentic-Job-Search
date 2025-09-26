"""
Email Template Generator for Job Recommendations
===============================================
Generates HTML and text email content for job recommendation notifications.
"""

def generate_html_email(first_name, category_display, job_recommendations):
    """Generate HTML email content for job recommendations"""
    
    # Create HTML email content
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: white; }}
            .header {{ background: linear-gradient(135deg, #8B1538, #FFC627); color: white; padding: 20px; text-align: center; }}
            .content {{ padding: 20px; }}
            .greeting {{ font-size: 18px; margin-bottom: 20px; color: #8B1538; }}
            .job-item {{ 
                border: 1px solid #e0e0e0; 
                border-radius: 8px; 
                margin-bottom: 20px; 
                padding: 20px; 
                background: white; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                border-left: 4px solid #FFC627;
            }}
            .job-header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }}
            .job-title {{ 
                font-size: 18px; 
                font-weight: bold; 
                color: #333; 
                margin: 0;
                line-height: 1.3;
            }}
            .job-company {{ 
                color: #666; 
                font-size: 14px; 
                margin-bottom: 12px; 
                font-weight: 500;
            }}
            .job-meta {{ 
                display: flex; 
                flex-wrap: wrap; 
                gap: 15px; 
                margin-bottom: 12px; 
                font-size: 13px;
                color: #666;
            }}
            .job-meta span {{ 
                display: inline-flex; 
                align-items: center; 
                gap: 4px;
            }}
            .job-location {{ color: #666; }}
            .job-salary {{ color: #2d5016; font-weight: 500; }}
            .job-category {{ color: #666; }}
            .job-type {{ 
                background: #f0f0f0; 
                padding: 2px 8px; 
                border-radius: 12px; 
                font-size: 12px;
                color: #333;
            }}
            .job-description {{ 
                color: #333; 
                line-height: 1.5; 
                margin-bottom: 12px; 
                font-size: 14px;
            }}
            .job-requirements {{ 
                color: #333; 
                font-size: 13px; 
                margin-bottom: 12px; 
                line-height: 1.4;
            }}
            .match-section {{ 
                background: #f8f9fa; 
                border-radius: 6px; 
                padding: 12px; 
                margin: 15px 0; 
                border-left: 3px solid #8B1538;
            }}
            .match-title {{ 
                font-weight: bold; 
                color: #8B1538; 
                font-size: 14px; 
                margin-bottom: 6px;
            }}
            .match-text {{ 
                color: #333; 
                font-size: 13px; 
                line-height: 1.4;
            }}
            .apply-btn {{ 
                background: #8B1538; 
                color: white !important; 
                padding: 10px 20px; 
                text-decoration: none; 
                border-radius: 6px; 
                display: inline-block; 
                font-weight: bold; 
                font-size: 14px;
                margin-top: 10px;
                border: none;
                cursor: pointer;
            }}
            .apply-btn:hover {{ background: #6B1028; color: white !important; }}
            .footer {{ background-color: #f8f8f8; padding: 15px; text-align: center; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Your Daily Job Recommendations</h1>
            </div>
            
            <div class="content">
                <div class="greeting">Good morning, {first_name}! 👋</div>
                
                <p>Here are your personalized {category_display.lower()} recommendations for today:</p>
                
                <div class="job-list">
    """
    
    # Add job listings from jobInformation field - show ALL jobs in each recommendation
    job_counter = 1
    for rec in job_recommendations:
        job_information = rec.get('jobInformation', [])
        if job_information and len(job_information) > 0:
            # Loop through ALL jobs in the jobInformation array
            for job in job_information:
                # Extract job details
                title = job.get('title', 'Job Opportunity')
                company = job.get('company', 'Company Name')
                location = job.get('location', 'Not specified')
                salary = job.get('salary', job.get('compensation', ''))
                job_type = job.get('type', job.get('employment_type', 'Full-Time'))
                category = job.get('category', job.get('department', 'Technology'))
                description = job.get('description', job.get('summary', ''))
                requirements = job.get('requirements', job.get('qualifications', ''))
                match_reason = job.get('fit', job.get('match_reason', 'Great match for your profile!'))
                apply_url = job.get('apply_url', job.get('url', '#'))
                
                html_content += f"""
                        <div class="job-item">
                            <div class="job-header">
                                <div class="job-title">{title}</div>
                            </div>
                            <div class="job-company">{company}</div>
                            
                            <div class="job-meta">
                                <span class="job-location">📍 {location}</span>
                                {f'<span class="job-salary">💰 {salary}</span>' if salary else ''}
                                <span class="job-category">🏢 {category}</span>
                                <span class="job-type">{job_type}</span>
                            </div>
                            
                            <div class="job-description">
                                {description[:200] + '...' if len(description) > 200 else description}
                            </div>
                            
                            {f'<div class="job-requirements"><strong>Requirements:</strong><br>• {requirements[:150]}{"..." if len(requirements) > 150 else ""}</div>' if requirements else ''}
                            
                            <div class="match-section">
                                <div class="match-title">Why this matches you</div>
                                <div class="match-text">{match_reason}</div>
                            </div>
                            
                            <a href="{apply_url}" class="apply-btn">Apply Now</a>
                        </div>
                """
                job_counter += 1
        else:
            html_content += f"""
                    <div class="job-item">
                        <div class="job-header">
                            <div class="job-title">New Job Opportunity</div>
                        </div>
                        <div class="job-company">Exciting Company</div>
                        <div class="job-meta">
                            <span class="job-location">📍 Based on your preferences</span>
                            <span class="job-type">Full-Time</span>
                        </div>
                        <div class="match-section">
                            <div class="match-title">Why this matches you</div>
                            <div class="match-text">A great opportunity that matches your profile!</div>
                        </div>
                        <a href="#" class="apply-btn">Apply Now</a>
                    </div>
            """
    
    html_content += f"""
                </div>
                
                <p style="margin-top: 20px;">Ready to take the next step? These opportunities are waiting for you!</p>
            </div>
            
            <div class="footer">
                <p>© 2024 ASU Career Services | Powered by AI Job Matching</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return html_content


def generate_text_email(first_name, category_display, job_recommendations):
    """Generate plain text email content for job recommendations"""
    
    # Create simple text version
    text_content = f"""
Good morning, {first_name}!

Here are your personalized {category_display.lower()} recommendations for today:

"""
    
    job_counter = 1
    for rec in job_recommendations:
        job_information = rec.get('jobInformation', [])
        if job_information and len(job_information) > 0:
            # Loop through ALL jobs in the jobInformation array
            for job in job_information:
                title = job.get('title', 'Job Opportunity')
                company = job.get('company', 'Company Name')
                location = job.get('location', 'Not specified')
                salary = job.get('salary', job.get('compensation', ''))
                job_type = job.get('type', job.get('employment_type', 'Full-Time'))
                match_reason = job.get('fit', job.get('match_reason', 'Great match for your profile!'))
                apply_url = job.get('apply_url', job.get('url', 'Contact employer directly'))
                
                text_content += f"""
{job_counter}. {title}
   Company: {company}
   Location: {location}
   {f'Salary: {salary}' if salary else ''}
   Type: {job_type}
   
   Why this matches you: {match_reason}
   
   Apply: {apply_url}

"""
                job_counter += 1
    
    text_content += """
Ready to take the next step? These opportunities are waiting for you!

© 2024 ASU Career Services | Powered by AI Job Matching
"""
    
    return text_content


