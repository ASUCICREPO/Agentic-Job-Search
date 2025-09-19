import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import { ASULogoImage, UserAvatarImage, BotAvatarImage } from '../components/ImageAssets';
import { invokeAgent } from '../services/agentService';
import JobPopup from '../components/JobPopup';

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
  justify-content: space-between;
  gap: 15px;
`;

const ASULogoContainer = styled.div`
  display: flex;
  align-items: center;
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1;
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

const ProfileButton = styled.button`
  background: #8B1538;
  color: white;
  border: none;
  border-radius: 25px;
  padding: 10px 20px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s ease, transform 0.1s ease;

  &:hover {
    background: #6d1028;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
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
  background: transparent;
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
  background: white;
  box-shadow: 0 2px 8px rgba(139, 21, 56, 0.1);
  transition: all 0.2s ease;

  &:focus-within {
    border-color: #6d1028;
    box-shadow: 0 4px 12px rgba(139, 21, 56, 0.2);
    transform: translateY(-1px);
  }
`;

const Input = styled.input`
  flex: 1;
  padding: 12px 18px;
  border: none;
  outline: none;
  font-size: 1rem;
  background: transparent;
  color: #333;
  font-weight: 400;

  &::placeholder {
    color: #999;
    font-style: italic;
  }

  &:focus {
    color: #333;
  }
`;

const SendButton = styled.button`
  background: #8B1538;
  color: white;
  border: none;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(139, 21, 56, 0.3);
  
  &:hover {
    background: #6d0f2a;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(139, 21, 56, 0.4);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 4px rgba(139, 21, 56, 0.3);
  }
  
  &:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

const SourcesToggleButton = styled.button`
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  color: #495057;
  border: 1px solid #dee2e6;
  padding: 10px 16px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  margin: 16px 0 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
    transition: left 0.5s ease;
  }

  &:hover {
    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
    color: #343a40;
    border-color: #adb5bd;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);

    &::before {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }
`;

const SourcesContainer = styled.div<{ $isExpanded: boolean }>`
  max-height: ${props => props.$isExpanded ? '300px' : '0px'};
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  margin-top: 12px;
  opacity: ${props => props.$isExpanded ? '1' : '0'};
`;

const SourcesList = styled.div`
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid #e9ecef;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  position: relative;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, #dee2e6, transparent);
  }
`;

const SourceLink = styled.a`
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border: 1px solid #dee2e6;
  border-radius: 12px;
  padding: 12px 16px;
  display: inline-flex;
  align-items: center;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  color: #495057;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 600;
  gap: 8px;

  &::before {
    content: "📄";
    font-size: 1rem;
    opacity: 0.8;
    transition: all 0.3s ease;
    z-index: 2;
    position: relative;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(52, 152, 219, 0.15), transparent);
    transition: left 0.6s ease;
    z-index: 1;
  }

  &:hover {
    background: linear-gradient(135deg, #e8f4f8 0%, #d1ecf1 100%);
    color: #2c3e50;
    border-color: #3498db;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(52, 152, 219, 0.2);
    text-decoration: none;

    &::before {
      opacity: 1;
      transform: scale(1.1);
    }

    &::after {
      left: 100%;
    }
  }

  &:active {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(52, 152, 219, 0.15);
  }

  &:focus {
    outline: 2px solid #3498db;
    outline-offset: 2px;
  }
`;



interface Message {
    id: number;
    text: string;
    isUser: boolean;
    timestamp: Date;
    hasJobButton?: boolean;
    jobQuery?: string;
    sources?: Array<{url: string, score: number}>;
}

interface Job {
  id: string;
  title: string;
  description: string;
  company: string;
  salary_max: string;
  salary_min: string;
  fit: string;
  location: string;
  type: string;
  industry: string;
  deadline: string;
  remote: string;
  experience: string;
}

// Helper function to update message with career advice and sources
const updateMessageWithCareerAdviceAndSources = (
    advice: string,
    sources: Array<{url: string, score: number}>,
    streamingMessageId: number | null,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>
) => {
    console.log('🔧 updateMessageWithCareerAdviceAndSources called:', {
        adviceLength: advice?.length,
        sourcesCount: sources?.length,
        streamingMessageId,
        hasSources: sources?.length > 0,
        advicePreview: advice?.substring(0, 50) + '...'
    });

    if (streamingMessageId) {
        console.log('📝 Updating existing message with ID:', streamingMessageId);
        setMessages(prev => {
            console.log('📝 Current messages before update:', prev.map(m => ({ id: m.id, textLength: m.text?.length })));
            const updated = prev.map(msg => {
                if (msg.id === streamingMessageId) {
                    console.log('📝 Found matching message, updating with career advice');
                    return {
                        ...msg,
                        text: advice,
                        sources: sources.length > 0 ? [...sources] : undefined
                    };
                }
                return msg;
            });
            console.log('📝 Messages after update:', updated.map(m => ({ id: m.id, textLength: m.text?.length })));
            return updated;
        });
    } else {
        console.log('📝 No streaming message ID, creating new message');
        // Fallback: create new message if no streaming message exists
        const botMessage: Message = {
            id: Date.now() + Math.random(),
            text: advice,
            isUser: false,
            timestamp: new Date(),
            sources: sources.length > 0 ? [...sources] : undefined
        };
        setMessages(prev => [...prev, botMessage]);
    }
};

// Helper function to extract filename from URL
const extractFilename = (url: string): string => {
  try {
    // Handle S3 URLs like s3://bucket/path/filename.pdf
    if (url.startsWith('s3://')) {
      const parts = url.split('/');
      return parts[parts.length - 1];
    }
    // Handle regular URLs
    const urlParts = url.split('/');
    return urlParts[urlParts.length - 1];
  } catch (error) {
    return url; // Fallback to full URL if parsing fails
  }
};

// Helper function to convert S3 URL to public HTTP URL
const convertS3ToPublicUrl = (url: string): string => {
  try {
    console.log('🔗 Converting URL:', url);

    // Handle S3 URLs like s3://bucket/path/filename.pdf
    if (url.startsWith('s3://')) {
      // Remove s3:// prefix and split by /
      const s3Path = url.substring(5); // Remove 's3://'
      const parts = s3Path.split('/');

      if (parts.length >= 2) {
        const bucket = parts[0];
        const key = parts.slice(1).join('/');

        // Convert to public S3 HTTP URL
        const publicUrl = `https://${bucket}.s3.amazonaws.com/${key}`;
        console.log('✅ Converted S3 URL to public URL:', publicUrl);
        return publicUrl;
      }
    }

    // If it's already an HTTP URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      console.log('ℹ️ URL is already HTTP/HTTPS:', url);
      return url;
    }

    // For any other URL format, return as is
    console.log('⚠️ URL is not S3 or HTTP format, returning as-is:', url);
    return url;
  } catch (error) {
    console.error('❌ Error converting S3 URL to public URL:', error);
    return url; // Fallback to original URL
  }
};

const ChatBotPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const userName = location.state?.userName || "User";
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isProcessingComplete, setIsProcessingComplete] = useState(true);
    const [currentlyStreamingMessageId, setCurrentlyStreamingMessageId] = useState<number | null>(null);
    const [showJobPopup, setShowJobPopup] = useState(false);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [currentSources, setCurrentSources] = useState<Array<{url: string, score: number}>>([]);
    const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
    const [pendingCareerAdvice, setPendingCareerAdvice] = useState<string | null>(null);
    const chatAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatAreaRef.current) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    // Handle return from profile page
    useEffect(() => {
        const profileUpdated = location.state?.profileUpdated;
        if (profileUpdated) {
            // Profile was updated, show success message and navigate to job options
            setTimeout(() => {
                navigate('/job-options', { state: { userName: userName } });
            }, 1000); // Brief delay to show the transition
        }
    }, [location.state, navigate, userName]);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const handleProfileClick = () => {
        navigate('/', { state: { fromChatbot: true, userName: userName } });
    };

    const handleViewJobs = () => {
        setShowJobPopup(true);
    };

    const toggleSources = (messageId: number) => {
        setExpandedSources(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return newSet;
        });
    };



    const handleSendMessage = async () => {
        if (!inputValue.trim()) return;

        console.log('🎯 Starting new request with input:', inputValue);
        console.log('🚀 === NEW REQUEST STARTED ===');
        console.log('📝 User input:', inputValue);

        const userMessage: Message = {
            id: Date.now() + Math.random(),
            text: inputValue,
            isUser: true,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        const currentInput = inputValue;
        setInputValue('');

        // Mark processing as started
        setIsProcessingComplete(false);

        // Show regular typing indicator initially
        setIsTyping(true);

        // Track streaming response accumulation
        let streamingResponse = '';
        let streamingMessageId: number | null = null;
        let hasJobResults = false;
        let hasCareerAdvice = false;
        let jobSearchStarted = false;
        let careerAdviceStarted = false;
        let streamingTimeout: NodeJS.Timeout | null = null;
        let orchestratorStarted = false;
        let waitingForResponse = false;
        let waitingForCareerAdviceResult = false;
        let waitingForJobResult = false;
        let waitingForFinalResult = false;
        let localPendingCareerAdvice: string | null = null; // Local variable for immediate access

        try {
            await invokeAgent(currentInput, {
                onThinking: (thinking: string) => {
                    console.log('🤔 onThinking received:', thinking);

                    if (!orchestratorStarted) {
                        console.log('🎭 === ORCHESTRATOR STARTED ===');
                        console.log('📝 Orchestrator thinking chunks will be ignored (as requested)');
                        orchestratorStarted = true;
                        console.log('🔄 Current state: Orchestrator active, ignoring thinking chunks');
                    }

                    // Ignore thinking chunks as per user request - only process response chunks
                    console.log('🚫 Ignoring thinking chunk (only response chunks matter)');
                },

                onJobSearchStarted: () => {
                    console.log('🔍 onJobSearchStarted triggered');
                    jobSearchStarted = true;
                    waitingForJobResult = true;
                    console.log('🎯 === STATE CHANGE: Job Search Started ===');
                    console.log('🔄 Current state: Waiting for job_agent_result');
                    console.log('📋 Will show job results when received');
                },

                onCareerAdviceStarted: () => {
                    console.log('💼 onCareerAdviceStarted triggered');
                    careerAdviceStarted = true;
                    waitingForCareerAdviceResult = true;
                    console.log('🎯 === STATE CHANGE: Career Advice Started ===');
                    console.log('🔄 Current state: Waiting for carrier_advice_result');
                    console.log('🎓 Will show career advice when received, then wait for sources');
                },

                onJobResults: (jobs: Job[], responseText: string) => {
                    console.log('📋 onJobResults received:', { jobsCount: jobs?.length, responseText: responseText?.substring(0, 100) });
                    console.log('✅ === JOB RESULTS RECEIVED ===');
                    console.log('🔄 State completed: job_agent_result received and processed');
                    setIsTyping(false);
                    hasJobResults = true;
                    waitingForJobResult = false;

                    // Clear any pending streaming timeout
                    if (streamingTimeout) {
                        clearTimeout(streamingTimeout);
                        streamingTimeout = null;
                    }

                    if (jobs && jobs.length > 0) {
                        setJobs(jobs);

                        // Update the existing streaming message with job results
                        if (streamingMessageId) {
                            setMessages(prev =>
                                prev.map(msg =>
                                    msg.id === streamingMessageId
                                        ? {
                                            ...msg,
                                            text: responseText,
                                            hasJobButton: true,
                                            jobQuery: currentInput
                                        }
                                        : msg
                                )
                            );
                        } else {
                            // Fallback: create new message if no streaming message exists
                            const botMessage: Message = {
                                id: Date.now() + Math.random(),
                                text: responseText,
                                isUser: false,
                                timestamp: new Date(),
                                hasJobButton: true,
                                jobQuery: currentInput
                            };
                            setMessages(prev => [...prev, botMessage]);
                        }
                    } else {
                        const errorText = "Sorry, I couldn't find any job opportunities at the moment. Please try again later.";

                        // Update the existing streaming message with error
                        if (streamingMessageId) {
                            setMessages(prev =>
                                prev.map(msg =>
                                    msg.id === streamingMessageId
                                        ? { ...msg, text: errorText }
                                        : msg
                                )
                            );
                        } else {
                            // Fallback: create new message if no streaming message exists
                            const errorMessage: Message = {
                                id: Date.now() + Math.random(),
                                text: errorText,
                                isUser: false,
                                timestamp: new Date()
                            };
                            setMessages(prev => [...prev, errorMessage]);
                        }
                    }
                },

                onCareerAdvice: (advice: string) => {
                    console.log('🎓 onCareerAdvice received:', advice?.substring(0, 100), '...');
                    console.log('✅ === CAREER ADVICE RESULT RECEIVED ===');
                    console.log('🔄 Current state: carrier_advice_result received, now waiting for sources');
                    console.log('📋 streamingMessageId at career advice:', streamingMessageId);
                    setIsTyping(false);
                    hasCareerAdvice = true;
                    waitingForCareerAdviceResult = false;

                    // Clear any pending streaming timeout
                    if (streamingTimeout) {
                        clearTimeout(streamingTimeout);
                        streamingTimeout = null;
                    }

                    // Store the career advice and check if we have sources ready
                    console.log('💾 Storing pending career advice');
                    console.log('📝 Career advice length:', advice?.length);
                    console.log('📝 Career advice preview:', advice?.substring(0, 100) + '...');
                    console.log('🔍 Before setting, localPendingCareerAdvice:', localPendingCareerAdvice);
                    console.log('🔍 Before setting, React pendingCareerAdvice:', pendingCareerAdvice);

                    // Store in both local variable and React state
                    localPendingCareerAdvice = advice;
                    setPendingCareerAdvice(advice);

                    console.log('✅ Pending career advice stored successfully');
                    console.log('🔍 After setting, localPendingCareerAdvice exists:', !!localPendingCareerAdvice);

                    // If we already have sources, update the message now
                    if (currentSources.length > 0) {
                        console.log('🔄 Sources already available, updating message immediately');
                        updateMessageWithCareerAdviceAndSources(advice, currentSources, streamingMessageId, setMessages);
                        setCurrentSources([]); // Clear sources for next request
                        setPendingCareerAdvice(null); // Clear React state
                        localPendingCareerAdvice = null; // Clear local variable
                    } else {
                        console.log('⏳ Sources not yet available, waiting for onSources callback');
                    }
                    // If no sources yet, wait for onSources callback
                },

                onSources: (sources: Array<{url: string, score: number}>) => {
                    console.log('📚 onSources received:', { count: sources?.length, sources: sources?.slice(0, 2) });
                    console.log('✅ === SOURCES RECEIVED ===');
                    console.log('🔄 State completed: sources received for career advice');
                    console.log('📋 streamingMessageId at sources:', streamingMessageId);
                    console.log('💾 localPendingCareerAdvice exists:', !!localPendingCareerAdvice);
                    console.log('💾 React pendingCareerAdvice exists:', !!pendingCareerAdvice);
                    setCurrentSources(sources);

                    // If we have pending career advice, update the message now
                    if (localPendingCareerAdvice) {
                        console.log('🔄 Updating message with pending career advice and sources');
                        updateMessageWithCareerAdviceAndSources(localPendingCareerAdvice, sources, streamingMessageId, setMessages);
                        setCurrentSources([]); // Clear sources for next request
                        setPendingCareerAdvice(null); // Clear React state
                        localPendingCareerAdvice = null; // Clear local variable
                        console.log('✅ Career advice flow completed successfully');
                    } else {
                        console.log('⚠️ No pending career advice found when sources received!');
                        console.log('🔍 Debug: hasCareerAdvice =', hasCareerAdvice);
                        console.log('🔍 Debug: careerAdviceStarted =', careerAdviceStarted);
                        console.log('🔍 Debug: localPendingCareerAdvice =', localPendingCareerAdvice);
                    }
                },

                onResponse: (response: string) => {
                    console.log('💬 onResponse received:', response?.substring(0, 100), '...');
                    console.log('🔍 Agent states:', {
                        careerAdviceStarted,
                        jobSearchStarted,
                        waitingForResponse,
                        waitingForCareerAdviceResult,
                        waitingForJobResult,
                        waitingForFinalResult
                    });

                    if (!waitingForResponse && !waitingForCareerAdviceResult && !waitingForJobResult) {
                        console.log('🎯 === ORCHESTRATOR RESPONSE STARTED ===');
                        console.log('🔄 Current state: Waiting for response chunks from orchestrator');
                        waitingForResponse = true;
                    }

                    // Skip orchestrator responses if specialized agents have been started
                    if (careerAdviceStarted || jobSearchStarted) {
                        console.log('🚫 Skipping orchestrator response - specialized agent handling');
                        console.log('🔄 Current state: Specialized agent is active');
                        return; // Don't process orchestrator response if specialized agents are handling it
                    }

                    console.log('📝 Processing orchestrator response chunk');
                    console.log('🔄 Current state: Accumulating response chunks, will keep looping until:');
                    console.log('  - carrier_advice_started received (then wait for carrier_advice_result + sources)');
                    console.log('  - job_search_started received (then wait for job_agent_result)');
                    console.log('  - final_result received (if neither specialized agent started)');

                    // Accumulate streaming response chunks with double new lines
                    if (streamingResponse.length > 0) {
                        streamingResponse += '\n\n' + response;
                    } else {
                        streamingResponse = response;
                    }

                    // Turn off typing indicator when first response chunk arrives
                    setIsTyping(false);

                    // Update or create the streaming message
                    if (streamingMessageId === null) {
                        // Create initial streaming message
                        streamingMessageId = Date.now() + Math.random();
                        console.log('📝 Created new streaming message with ID:', streamingMessageId);
                        const botMessage: Message = {
                            id: streamingMessageId,
                            text: streamingResponse,
                            isUser: false,
                            timestamp: new Date()
                        };
                        setMessages(prev => [...prev, botMessage]);

                        // Clear any existing timeout
                        if (streamingTimeout) {
                            clearTimeout(streamingTimeout);
                        }

                        // Wait 1 second before showing loading dots (only if streaming continues)
                        streamingTimeout = setTimeout(() => {
                            // Only show dots if this message is still the current streaming message
                            if (streamingMessageId && !hasJobResults && !hasCareerAdvice && !jobSearchStarted && !careerAdviceStarted) {
                                setCurrentlyStreamingMessageId(streamingMessageId);
                            }
                        }, 1000);
                    } else {
                        // Update existing streaming message
                        setMessages(prev =>
                            prev.map(msg =>
                                msg.id === streamingMessageId
                                    ? { ...msg, text: streamingResponse }
                                    : msg
                            )
                        );
                    }
                },

                onError: (error: string) => {
                    console.error('❌ Agent error received:', error);
                    console.log('🔄 State: Error occurred during processing');
                    setIsTyping(false);
                    // Only show error message if it's not a generic processing error and no results were received
                    if (!error.includes("Error processing request: 'output'") && !hasJobResults && !hasCareerAdvice) {
                        const errorMessage: Message = {
                            id: Date.now() + Math.random(),
                            text: error,
                            isUser: false,
                            timestamp: new Date()
                        };
                        setMessages(prev => [...prev, errorMessage]);
                    } else if (!error.includes("Error processing request: 'output'")) {
                        // Ignoring backend processing error - job results already received
                        console.log('⚠️ Ignoring backend processing error - results already received');
                    }
                }
            });

            console.log('✅ invokeAgent completed successfully');

            // Summary of what happened in this request
            console.log('📊 === REQUEST SUMMARY ===');
            console.log('🎭 Orchestrator started:', orchestratorStarted);
            console.log('🔍 Job search started:', jobSearchStarted);
            console.log('💼 Career advice started:', careerAdviceStarted);
            console.log('📋 Job results received:', hasJobResults);
            console.log('🎓 Career advice received:', hasCareerAdvice);
            console.log('🔄 Final state:', {
                waitingForResponse,
                waitingForCareerAdviceResult,
                waitingForJobResult,
                waitingForFinalResult
            });

            if (jobSearchStarted && hasJobResults) {
                console.log('✅ Flow completed: Job search -> Job results');
            } else if (careerAdviceStarted && hasCareerAdvice) {
                console.log('✅ Flow completed: Career advice -> Career advice result -> Sources');
            } else if (!jobSearchStarted && !careerAdviceStarted) {
                console.log('✅ Flow completed: Orchestrator response (no specialized agents)');
            }

        } catch (error) {
            console.error('❌ Error in handleSendMessage:', error);
            console.log('📊 === REQUEST SUMMARY (ERROR) ===');
            console.log('🎭 Orchestrator started:', orchestratorStarted);
            console.log('🔍 Job search started:', jobSearchStarted);
            console.log('💼 Career advice started:', careerAdviceStarted);
            console.log('📋 Job results received:', hasJobResults);
            console.log('🎓 Career advice received:', hasCareerAdvice);

            const errorMessage: Message = {
                id: Date.now() + Math.random(),
                text: "Sorry, I'm having trouble connecting right now. Please try again later.",
                isUser: false,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            console.log('🧹 Finally block - cleaning up');
            setIsTyping(false);
            setIsProcessingComplete(true);
            setCurrentlyStreamingMessageId(null);
            console.log('🧹 Set currentlyStreamingMessageId to null');

            // Clear any pending streaming timeout
            if (streamingTimeout) {
                clearTimeout(streamingTimeout);
                streamingTimeout = null;
            }

            // Clear any pending states
            setCurrentSources([]);
            // Don't clear pendingCareerAdvice here - it will be cleared when sources are received
            // or it will be kept for the next request if sources never arrive
            console.log('🧹 Final cleanup - hasCareerAdvice:', hasCareerAdvice, 'pendingCareerAdvice exists:', !!pendingCareerAdvice);
            console.log('🧹 Cleared streamingMessageId:', streamingMessageId);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && isProcessingComplete) {
            handleSendMessage();
        }
    };

    return (
        <ChatContainer>
            <Header>
                <LeftSection>
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
                </LeftSection>
                <ProfileButton onClick={handleProfileClick}>
                    👤 Profile
                </ProfileButton>
            </Header>

            <ChatArea ref={chatAreaRef}>
                {messages.map((message, index) => {

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
                                        <BotMessageBubble>
                                            <ReactMarkdown
                                                components={{
                                                    p: ({children}) => <p style={{ margin: '8px 0', lineHeight: '1.4' }}>{children}</p>,
                                                    strong: ({children}) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
                                                    em: ({children}) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
                                                    ul: ({children}) => <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ul>,
                                                    ol: ({children}) => <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>{children}</ol>,
                                                    li: ({children}) => <li style={{ margin: '4px 0' }}>{children}</li>,
                                                    code: ({children}) => <code style={{
                                                        backgroundColor: '#f4f4f4',
                                                        padding: '2px 4px',
                                                        borderRadius: '3px',
                                                        fontFamily: 'monospace',
                                                        fontSize: '0.9em'
                                                    }}>{children}</code>,
                                                    pre: ({children}) => <pre style={{
                                                        backgroundColor: '#f4f4f4',
                                                        padding: '12px',
                                                        borderRadius: '6px',
                                                        overflow: 'auto',
                                                        fontSize: '0.9em',
                                                        margin: '8px 0'
                                                    }}>{children}</pre>,
                                                    h1: ({children}) => <h1 style={{
                                                        fontSize: '1.5em',
                                                        fontWeight: 'bold',
                                                        margin: '12px 0 8px 0',
                                                        color: '#333'
                                                    }}>{children}</h1>,
                                                    h2: ({children}) => <h2 style={{
                                                        fontSize: '1.3em',
                                                        fontWeight: 'bold',
                                                        margin: '10px 0 6px 0',
                                                        color: '#333'
                                                    }}>{children}</h2>,
                                                    h3: ({children}) => <h3 style={{
                                                        fontSize: '1.2em',
                                                        fontWeight: 'bold',
                                                        margin: '8px 0 4px 0',
                                                        color: '#333'
                                                    }}>{children}</h3>
                                                }}
                                            >
                                                {message.text}
                                            </ReactMarkdown>
                                            {message.id === currentlyStreamingMessageId && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '8px' }}>
                                                    <TypingDot />
                                                    <TypingDot />
                                                    <TypingDot />
                                                </span>
                                            )}
                                            {message.hasJobButton && (
                                                <>
                                                    <ViewJobsButton onClick={handleViewJobs}>
                                                        <strong>Click to View</strong> Jobs
                                                    </ViewJobsButton>
                                                </>
                                            )}
                                            {message.sources && message.sources.length > 0 && (
                                                <>
                                                    <SourcesToggleButton
                                                        onClick={() => toggleSources(message.id)}
                                                    >
                                                        📚 Sources ({message.sources.length})
                                                        {expandedSources.has(message.id) ? ' ▲' : ' ▼'}
                                                    </SourcesToggleButton>
                                                    <SourcesContainer $isExpanded={expandedSources.has(message.id)}>
                                                        <SourcesList>
                                                            {message.sources.map((source, index) => (
                                                                <SourceLink
                                                                    key={index}
                                                                    href={convertS3ToPublicUrl(source.url)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    title={source.url}
                                                                >
                                                                    {extractFilename(source.url)}
                                                                </SourceLink>
                                                            ))}
                                                        </SourcesList>
                                                    </SourcesContainer>
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
                        disabled={!inputValue.trim() || isTyping || !isProcessingComplete}
                    >
                        ➤
                    </SendButton>
                </InputWrapper>
            </InputContainer>
            
            {showJobPopup && (
                <JobPopup 
                    jobs={jobs} 
                    onClose={() => setShowJobPopup(false)}
                    selectedJobRole={jobs.length > 0 ? jobs[0].title : undefined}
                />
            )}
        </ChatContainer>
    );
};

export default ChatBotPage;