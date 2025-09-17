import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { ASULogoImage, UserAvatarImage, BotAvatarImage } from '../components/ImageAssets';
import { invokeAgent } from '../services/agentService';
import JobPopup from '../components/JobPopup';
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from '@aws-sdk/client-bedrock-agentcore';

const ChatContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f0f0;
`;

const Header = styled.div`
  background: white;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 15px;
`;

const ASULogoContainer = styled.div`
  display: flex;
  align-items: center;
`;

const WelcomeSection = styled.div`
  display: flex;
  flex-direction: column;
`;

const WelcomeTitle = styled.h1`
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
`;

const UserGreeting = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 0.9rem;
  margin-top: 5px;
`;

const UserIcon = styled.div`
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
`;

const ChatArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const MessageContainer = styled.div<{ $isUser: boolean }>`
  display: flex;
  justify-content: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  align-items: flex-start;
  gap: 10px;
`;

const BotMessageWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 60%;
`;

const BotContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

const BotMessageBubble = styled.div`
  background: linear-gradient(135deg, #FFF9C4 0%, #FFC627 100%);
  padding: 15px 20px;
  border-radius: 20px;
  color: #333;
  font-size: 0.95rem;
  line-height: 1.4;
  position: relative;
`;

const UserMessageWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  max-width: 60%;
`;

const UserAvatarContainer = styled.div`
  margin-left: 10px;
`;

const UserMessageBubble = styled.div`
  background: linear-gradient(135deg, #e1bee7 0%, #b3e5fc 100%);
  padding: 15px 20px;
  border-radius: 20px;
  color: #333;
  font-size: 0.95rem;
  line-height: 1.4;
  margin-bottom: 5px;
`;

const Timestamp = styled.div`
  font-size: 0.8rem;
  color: #666;
  margin-top: 5px;
`;

const InputContainer = styled.div`
  padding: 20px 80px 50px 80px;
  background: white;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding: 20px 40px 40px 40px;
  }

  @media (max-width: 480px) {
    padding: 20px 25px 30px 25px;
  }
`;

const InputWrapper = styled.div`
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  border: 2px solid #8B1538;
  border-radius: 25px;
  padding: 5px;
`;

const Input = styled.input`
  flex: 1;
  padding: 10px 15px;
  border: none;
  outline: none;
  font-size: 1rem;
  background: transparent;
`;

const SendButton = styled.button`
  background: #8B1538;
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  
  &:hover {
    background: #6d0f2a;
  }
  
  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 15px 20px;
  background: linear-gradient(135deg, #FFF9C4 0%, #FFC627 100%);
  border-radius: 20px;
  max-width: 60%;
`;

const TypingDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #333;
  animation: typing 1.4s infinite ease-in-out;
  
  &:nth-child(1) { animation-delay: -0.32s; }
  &:nth-child(2) { animation-delay: -0.16s; }
  
  @keyframes typing {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }
`;

const SpecialTypingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 15px 20px;
  background: linear-gradient(135deg, #FFF9C4 0%, #FFC627 100%);
  border-radius: 20px;
  max-width: 60%;
  font-size: 0.95rem;
  color: #333;
`;

const TypingDotsContainer = styled.div`
  display: flex;
  gap: 3px;
`;

const ViewJobsButton = styled.button`
  background: #8B1538;
  color: white;
  border: none;
  padding: 12px 20px;
  border-radius: 6px;
  cursor: pointer;
  margin: 12px auto 0 auto;
  display: block;
  font-size: 1rem;
  font-weight: 600;
  
  &:hover {
    background: #6d1028;
  }
`;

const CareerAdviceContainer = styled.div`
  margin-top: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #FFF9C4 0%, #FFC627 100%);
  border-radius: 8px;
  border-left: 4px solid #8B1538;
`;

const CareerAdviceTitle = styled.h3`
  color: #8B1538;
  font-size: 1.1rem;
  margin: 0 0 12px 0;
  font-weight: 600;
`;

const CareerAdviceList = styled.ul`
  margin: 0;
  padding-left: 20px;
  color: #333;
  line-height: 1.6;
`;

const CareerAdviceItem = styled.li`
  margin-bottom: 8px;
  
  &::marker {
    color: #8B1538;
  }
`;

const CareerAdviceSubList = styled.ul`
  margin: 8px 0 0 0;
  padding-left: 20px;
  
  li {
    margin-bottom: 4px;
    color: #555;
    
    &::marker {
      color: #666;
    }
  }
`;

interface Message {
    id: number;
    text: string;
    isUser: boolean;
    timestamp: Date;
    hasJobButton?: boolean;
    jobQuery?: string;
    isCareerAdvice?: boolean;
}

interface Job {
  "Job Id": string;
  "Job Title": string;
  "Job Description": string;
  "Employer Name": string;
  "Salary Pay Upper Cap": string;
  "Salary Pay Lower Cap": string;
  "Location": string;
  "Employment Type": string;
  "Industry": string;
  "Required Experience": string;
}

const ChatBotPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const userName = location.state?.userName || "User";
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isSpecialTyping, setIsSpecialTyping] = useState(false);
    const [showJobPopup, setShowJobPopup] = useState(false);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [currentJobQuery, setCurrentJobQuery] = useState<string>('');
    const chatAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatAreaRef.current) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };



    const fetchJobs = async (query: string) => {
        try {
            console.log('Fetching jobs for query:', query);
            const client = new BedrockAgentCoreClient({
                region: process.env.REACT_APP_AWS_REGION!,
                credentials: {
                    accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID!,
                    secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY!,
                },
            });

            const runtimeSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 20)}-extra`;
            console.log('Using session ID:', runtimeSessionId);
            
            const payload = {
                prompt: `Find job recommendations for: ${query}`,
                session_id: runtimeSessionId,
                source: "livesearch"
            };
            console.log('Payload:', payload);

            const input = {
                runtimeSessionId: runtimeSessionId,
                agentRuntimeArn: process.env.REACT_APP_AGENT_RUNTIME_ARN!,
                qualifier: process.env.REACT_APP_AGENT_QUALIFIER || "DEFAULT",
                payload: new TextEncoder().encode(JSON.stringify(payload)),
            };
            console.log('Agent input:', input);

            const command = new InvokeAgentRuntimeCommand(input);
            const response = await client.send(command);
            console.log('Raw agent response:', response);
            
            const textResponse = await response.response?.transformToString();
            console.log('Text response:', textResponse);
            
            let jobData: Job[] = [];
            if (textResponse) {
                // Look for job_agent_result in the streaming response
                const jobResultMatch = textResponse.match(/"job_agent_result":\s*"(\[[\s\S]*?\])(?:\\n\\nWould you like daily notifications[^"]*)?"/);
                
                if (jobResultMatch) {
                    console.log('Found job result match:', jobResultMatch[1]);
                    try {
                        let jobJsonString = jobResultMatch[1]
                            .replace(/\\n/g, '\n')  // Convert escaped newlines
                            .replace(/\\"/g, '"')  // Convert escaped quotes
                            .replace(/\\\\/g, '\\') // Convert escaped backslashes
                            .replace(/\\&/g, '&');   // Convert escaped ampersands
                        
                        // Remove any trailing notification text that might be part of the JSON
                        const cleanJsonMatch = jobJsonString.match(/(\[[\s\S]*?\])/);
                        if (cleanJsonMatch) {
                            jobJsonString = cleanJsonMatch[1];
                        }
                        
                        console.log('Cleaned job JSON string:', jobJsonString);
                        jobData = JSON.parse(jobJsonString);
                        console.log('Parsed job data:', jobData);
                    } catch (error) {
                        console.error('Error parsing job data:', error);
                        console.log('Raw match that failed to parse:', jobResultMatch[1]);
                    }
                } else {
                    console.log('No job_agent_result found in response');
                    console.log('Full response for debugging:', textResponse);
                }
            } else {
                console.log('No text response received');
            }
            
            if (jobData.length === 0) {
                jobData = [
                    {
                        "Job Id": "10000039",
                        "Job Title": "Software Developer",
                        "Job Description": "ASU-ready engineering role applying hands-on, project-based learning to real problems.",
                        "Employer Name": "Apex Media 39",
                        "Salary Pay Upper Cap": "111096",
                        "Salary Pay Lower Cap": "92460",
                        "Location": "Arizona, United States",
                        "Employment Type": "Full-Time",
                        "Industry": "Engineering & Technology",
                        "Required Experience": "Not specified"
                    },
                    {
                        "Job Id": "10000089",
                        "Job Title": "Machine Learning Engineer",
                        "Job Description": "As a Machine Learning Engineer at Sonoran Ventures 89, you will design and build scalable solutions.",
                        "Employer Name": "Sonoran Ventures 89",
                        "Salary Pay Upper Cap": "110663",
                        "Salary Pay Lower Cap": "71789",
                        "Location": "Arizona, United States",
                        "Employment Type": "Full-Time",
                        "Industry": "Engineering & Technology",
                        "Required Experience": "Recent Graduate (0-1 years)"
                    },
                    {
                        "Job Id": "10000284",
                        "Job Title": "Software Engineer I",
                        "Job Description": "As a Software Engineer I at Saguaro Publishing 284, you will design and build scalable solutions.",
                        "Employer Name": "Saguaro Publishing 284",
                        "Salary Pay Upper Cap": "Not specified",
                        "Salary Pay Lower Cap": "Not specified",
                        "Location": "Mesa, Arizona, United States",
                        "Employment Type": "Full-Time",
                        "Industry": "Engineering & Technology",
                        "Required Experience": "Graduate"
                    }
                ];
            }
            
            console.log('Final job data to return:', jobData);
            return jobData;
        } catch (error) {
            console.error('Error fetching jobs:', error);
            console.error('Error details:', error);
            return [];
        }
    };

    const handleViewJobs = () => {
        setShowJobPopup(true);
    };

    const isJobQuery = (text: string): boolean => {
        const lowerText = text.toLowerCase();
        
        const jobSearchPatterns = [
            /find.*job/,
            /search.*job/,
            /looking for.*job/,
            /show.*job/,
            /recommend.*job/,
            /job.*recommend/,
            /job.*search/,
            /job.*opening/,
            /employment.*opportunit/,
            /hiring.*position/
        ];
        
        return jobSearchPatterns.some(pattern => pattern.test(lowerText));
    };

    const isCareerAdviceQuery = (text: string): boolean => {
        const lowerText = text.toLowerCase();
        
        const careerAdvicePatterns = [
            /career.*advice/,
            /career.*guidance/,
            /career.*help/,
            /career.*tips/,
            /career.*counsel/,
            /professional.*development/,
            /career.*planning/,
            /career.*path/,
            /career.*opportunit/
        ];
        
        return careerAdvicePatterns.some(pattern => pattern.test(lowerText));
    };

    const formatCareerAdvice = (text: string) => {
        return (
            <CareerAdviceContainer>
                <CareerAdviceTitle>Career Guidance</CareerAdviceTitle>
                <div style={{ lineHeight: '1.6' }}>
                    {text.split('\n').map((line, index) => {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) return <br key={index} />;
                        
                        // Section headers (like "Pros of Switching to Data Science:")
                        if (trimmedLine.endsWith(':') && !trimmedLine.startsWith('-') && !trimmedLine.match(/^\d+\./)) {
                            return (
                                <div key={index} style={{ 
                                    fontWeight: 'bold', 
                                    color: '#8B1538', 
                                    fontSize: '1.1rem',
                                    marginTop: '16px',
                                    marginBottom: '8px'
                                }}>
                                    {trimmedLine}
                                </div>
                            );
                        }
                        // Main numbered points (1. Career Opportunities)
                        else if (/^\d+\./.test(trimmedLine)) {
                            return (
                                <div key={index} style={{
                                    fontWeight: '600',
                                    color: '#333',
                                    marginTop: '12px',
                                    marginBottom: '6px'
                                }}>
                                    {trimmedLine}
                                </div>
                            );
                        }
                        // Sub-points with dashes (- Data Scientist)
                        else if (/^\s*-/.test(line)) {
                            return (
                                <div key={index} style={{ 
                                    marginLeft: '20px', 
                                    color: '#555', 
                                    marginBottom: '4px',
                                    display: 'flex',
                                    alignItems: 'flex-start'
                                }}>
                                    <span style={{ marginRight: '8px', color: '#8B1538' }}>•</span>
                                    <span>{trimmedLine.replace(/^\s*-\s*/, '')}</span>
                                </div>
                            );
                        }
                        // Indented content (salary ranges, descriptions)
                        else if (/^\s{2,}/.test(line)) {
                            return (
                                <div key={index} style={{ 
                                    marginLeft: '40px', 
                                    color: '#666', 
                                    fontSize: '0.95rem',
                                    marginBottom: '4px'
                                }}>
                                    {trimmedLine}
                                </div>
                            );
                        }
                        // Regular paragraphs
                        else {
                            return (
                                <div key={index} style={{
                                    color: '#333',
                                    marginBottom: '8px'
                                }}>
                                    {trimmedLine}
                                </div>
                            );
                        }
                    })}
                </div>
            </CareerAdviceContainer>
        );
    };

    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        const userMessage: Message = {
            id: Date.now() + Math.random(),
            text: inputValue,
            isUser: true,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        const currentInput = inputValue;
        setInputValue('');
        
        // Check if this is a job search or career advice query and show special typing immediately
        if (isJobQuery(currentInput) || isCareerAdviceQuery(currentInput)) {
            setIsSpecialTyping(true);
        } else {
            setIsTyping(true);
        }

        try {
            const response = await invokeAgent(currentInput);
            console.log('Agent response:', response);
            
            // Check for job search response
            if (response.includes('"job_search_started": true')) {
                console.log('Job search detected in response');
                
                // Process immediately since special typing is already showing
                setTimeout(() => {
                    setIsSpecialTyping(false);
                    // Extract jobs directly from the agent response
                    const jobResultMatch = response.match(/"job_agent_result":\s*"([\s\S]*?)"(?:\s*}|\s*data:)/);
                    if (jobResultMatch) {
                        try {
                            let jobJsonString = jobResultMatch[1]
                                .replace(/\\n/g, '\n')
                                .replace(/\\"/g, '"')
                                .replace(/\\\\/g, '\\');
                            
                            // Remove any trailing notification text
                            const cleanJsonMatch = jobJsonString.match(/(\[[\s\S]*?\])/);
                            if (cleanJsonMatch) {
                                jobJsonString = cleanJsonMatch[1];
                            }
                            
                            console.log('Extracted job data from agent response:', jobJsonString);
                            const jobData = JSON.parse(jobJsonString);
                            
                            if (jobData && jobData.length > 0) {
                                setJobs(jobData);
                                
                                const botMessage: Message = {
                                    id: Date.now() + Math.random(),
                                    text: "Here is your desired job list.",
                                    isUser: false,
                                    timestamp: new Date(),
                                    hasJobButton: true,
                                    jobQuery: currentInput
                                };
                                setMessages(prev => [...prev, botMessage]);
                            } else {
                                const errorMessage: Message = {
                                    id: Date.now() + Math.random(),
                                    text: "Sorry, I couldn't find any job opportunities at the moment. Please try again later.",
                                    isUser: false,
                                    timestamp: new Date()
                                };
                                setMessages(prev => [...prev, errorMessage]);
                            }
                        } catch (error) {
                            console.error('Error parsing job data from agent response:', error);
                            const errorMessage: Message = {
                                id: Date.now() + Math.random(),
                                text: "Sorry, I'm having trouble processing the job results. Please try again later.",
                                isUser: false,
                                timestamp: new Date()
                            };
                            setMessages(prev => [...prev, errorMessage]);
                        }
                    } else {
                        const errorMessage: Message = {
                            id: Date.now() + Math.random(),
                            text: "Sorry, I couldn't find any job opportunities at the moment. Please try again later.",
                            isUser: false,
                            timestamp: new Date()
                        };
                        setMessages(prev => [...prev, errorMessage]);
                    }
                    
                }, 1500);
                return;
            }
            
            // Check for career advice response
            if (response.includes('"carrier_advice_started": true')) {
                console.log('Career advice detected in response');
                
                // Process immediately since special typing is already showing
                setTimeout(() => {
                    setIsSpecialTyping(false);
                    const careerAdviceMatch = response.match(/"carrier_advice_result":\s*"([\s\S]*?)"\s*}/);
                    if (careerAdviceMatch) {
                        const adviceText = careerAdviceMatch[1]
                            .replace(/\\n/g, '\n')
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, '\\');
                        
                        console.log('Extracted career advice:', adviceText);
                        
                        const botMessage: Message = {
                            id: Date.now() + Math.random(),
                            text: adviceText,
                            isUser: false,
                            timestamp: new Date(),
                            isCareerAdvice: true
                        };
                        setMessages(prev => [...prev, botMessage]);
                    }
                }, 1500);
                return;
            }

            console.log('Processing as regular query:', currentInput);

            // Extract final_result from the response
            let displayText = '';
            try {
                const finalResultMatch = response.match(/"final_result":\s*"([^"]+)"/);
                if (finalResultMatch) {
                    displayText = finalResultMatch[1]
                        .replace(/\\n/g, '\n')
                        .replace(/\\"/g, '"')
                        .replace(/\\\\/g, '\\');
                    console.log('Extracted final_result:', displayText);
                } else {
                    console.log('No final_result found, using full response');
                    displayText = response;
                }
            } catch (error) {
                console.error('Error extracting final_result:', error);
                displayText = response;
            }

            const botMessage: Message = {
                id: Date.now() + Math.random(),
                text: displayText,
                isUser: false,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Error in handleSendMessage:', error);
            const errorMessage: Message = {
                id: Date.now() + Math.random(),
                text: "Sorry, I'm having trouble connecting right now. Please try again later.",
                isUser: false,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsTyping(false);
            setIsSpecialTyping(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    };

    return (
        <ChatContainer>
            <Header>
                <ASULogoContainer>
                    <ASULogoImage />
                </ASULogoContainer>
                <WelcomeSection>
                    <WelcomeTitle>Welcome to ASU Job Search!</WelcomeTitle>
                    <UserGreeting>
                        <UserIcon>👤</UserIcon>
                        Hi, {userName}
                    </UserGreeting>
                </WelcomeSection>
            </Header>

            <ChatArea ref={chatAreaRef}>
                {messages.map((message, index) => {
                    // Calculate bot message index for color variation
                    const botMessageIndex = messages.slice(0, index + 1).filter(m => !m.isUser).length - 1;

                    return (
                        <MessageContainer key={message.id} $isUser={message.isUser}>
                            {message.isUser ? (
                                <UserMessageWrapper>
                                    <UserMessageBubble>
                                        {message.text}
                                    </UserMessageBubble>
                                    <Timestamp>{formatTime(message.timestamp)}</Timestamp>
                                </UserMessageWrapper>
                            ) : (
                                <BotMessageWrapper>
                                    <BotAvatarImage />
                                    <BotContentWrapper>
                                        <BotMessageBubble style={{ whiteSpace: 'pre-line' }}>
                                            {message.isCareerAdvice ? formatCareerAdvice(message.text) : message.text}
                                            {message.hasJobButton && (
                                                <>
                                                    <ViewJobsButton onClick={handleViewJobs}>
                                                        <strong>Click to View</strong> Jobs
                                                    </ViewJobsButton>
                                                    <div style={{ textAlign: 'center', marginTop: '8px' }}>
                                                        Would you like daily notifications with job recommendations?
                                                    </div>
                                                </>
                                            )}
                                        </BotMessageBubble>
                                        <Timestamp>{formatTime(message.timestamp)}</Timestamp>
                                    </BotContentWrapper>
                                </BotMessageWrapper>
                            )}
                            {message.isUser && (
                                <UserAvatarContainer>
                                    <UserAvatarImage />
                                </UserAvatarContainer>
                            )}
                        </MessageContainer>
                    );
                })}

                {isTyping && (
                    <MessageContainer $isUser={false}>
                        <BotMessageWrapper>
                            <BotAvatarImage />
                            <TypingIndicator>
                                <TypingDot />
                                <TypingDot />
                                <TypingDot />
                            </TypingIndicator>
                        </BotMessageWrapper>
                    </MessageContainer>
                )}
                
                {isSpecialTyping && (
                    <MessageContainer $isUser={false}>
                        <BotMessageWrapper>
                            <BotAvatarImage />
                            <SpecialTypingIndicator>
                                Let me help you with that
                                <TypingDotsContainer>
                                    <TypingDot />
                                    <TypingDot />
                                    <TypingDot />
                                </TypingDotsContainer>
                            </SpecialTypingIndicator>
                        </BotMessageWrapper>
                    </MessageContainer>
                )}
            </ChatArea>

            <InputContainer>
                <InputWrapper>
                    <Input
                        type="text"
                        placeholder={messages.length === 0 ? "Ask me about jobs, internships, or career advice..." : "Type your message..."}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                    />
                    <SendButton
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isTyping}
                    >
                        ➤
                    </SendButton>
                </InputWrapper>
            </InputContainer>
            
            {showJobPopup && (
                <JobPopup 
                    jobs={jobs} 
                    onClose={() => setShowJobPopup(false)} 
                />
            )}
        </ChatContainer>
    );
};

export default ChatBotPage;