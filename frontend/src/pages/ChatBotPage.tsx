import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { ASULogoImage, UserAvatarImage, BotAvatarImage, CarrierAvatarImage } from '../components/ImageAssets';
import { invokeAgent } from '../services/agentService';
import { getJobRecommendations, parseSmsLinkParams } from '../services/jobRecommendationsService';
import { getProfile } from '../services/profileService';
import JobGrid from '../components/JobGrid';
import loadingAnimation from '../assets/loadinganimation.lottie';
import {
  ChatContainer,
  Header,
  ASULogoContainer,
  LeftSection,
  WelcomeSection,
  WelcomeTitle,
  UserGreeting,
  UserIcon,
  ProfileButton,
  ChatArea,
  MessageContainer,
  BotMessageWrapper,
  BotContentWrapper,
  BotMessageBubble,
  UserMessageWrapper,
  UserAvatarContainer,
  UserMessageBubble,
  Timestamp,
  InputContainer,
  InputWrapper,
  Input,
  SendButton,
  TypingIndicator,
  TypingDot,
  SourcesToggleButton,
  SourcesContainer,
  SourcesList,
  SourceLink
} from './ChatBotPage.styles';



interface Message {
    id: number;
    text: string;
    isUser: boolean;
    timestamp: Date;
    jobs?: Job[];
    sources?: Array<{url: string, score: number}>;
    isStreaming?: boolean;
    isCareerAdvice?: boolean;  // Track if this is a career advice message
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
    if (streamingMessageId) {
        setMessages(prev => prev.map(msg =>
            msg.id === streamingMessageId
                ? {
                    ...msg,
                    text: advice,
                    sources: sources.length > 0 ? [...sources] : undefined
                }
                : msg
        ));
    } else {
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
    // Handle S3 URLs like s3://bucket/path/filename.pdf
    if (url.startsWith('s3://')) {
      // Remove s3:// prefix and split by /
      const s3Path = url.substring(5); // Remove 's3://'
      const parts = s3Path.split('/');

      if (parts.length >= 2) {
        const bucket = parts[0];
        const key = parts.slice(1).join('/');

        // Convert to public S3 HTTP URL
        return `https://${bucket}.s3.amazonaws.com/${key}`;
      }
    }

    // If it's already an HTTP URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // For any other URL format, return as is
    return url;
  } catch (error) {
    console.error('Error converting S3 URL to public URL:', error);
    return url; // Fallback to original URL
  }
};

const ChatBotPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [userName, setUserName] = useState<string>(location.state?.userName || "User");
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isProcessingComplete, setIsProcessingComplete] = useState(true);
    const [currentlyStreamingMessageId, setCurrentlyStreamingMessageId] = useState<number | null>(null);
    const [currentSources, setCurrentSources] = useState<Array<{url: string, score: number}>>([]);
    const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [pendingCareerAdvice, setPendingCareerAdvice] = useState<string | null>(null);
    const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
    const [isLoadingJobs, setIsLoadingJobs] = useState(false); // Track job search loading state
    const [jobResultsReceived, setJobResultsReceived] = useState(false); // Track if job results were received
    const chatAreaRef = useRef<HTMLDivElement>(null);

    // Auto-scroll functionality - disabled after job results until new query
    useEffect(() => {
        if (chatAreaRef.current && !jobResultsReceived) {
            chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
    }, [messages, isTyping, jobResultsReceived]);

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

    // Handle SMS link parameters - load job recommendations on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const loadJobRecommendationsFromUrl = async () => {
            const params = parseSmsLinkParams();

            if (params && params.userJobKey && params.createdAt) {
                setIsLoadingRecommendations(true);
                try {
                    console.log('Loading job recommendations from SMS link:', params);
                    const recommendations = await getJobRecommendations(params.userJobKey, params.createdAt);

                    // Load user profile to get full name
                    if (recommendations.email) {
                        try {
                            const profile = await getProfile(recommendations.email);
                            if (profile && profile.fullName && profile.fullName !== 'N/A') {
                                setUserName(profile.fullName);
                            }
                        } catch (profileError) {
                            console.error('Failed to load user profile:', profileError);
                            // Continue with default user name
                        }
                    }

                    // Transform the DynamoDB response format to match JobGrid expectations
                    const transformedJobs = recommendations.jobInformation.map((jobItem: any) => {
                        const jobData = jobItem.M || jobItem;

                        return {
                            id: Math.random().toString(36).substr(2, 9), // Generate unique ID
                            title: jobData.title?.S || jobData.title || 'Unknown Title',
                            description: jobData.description?.S || jobData.description || '',
                            company: jobData.company?.S || jobData.company || '',
                            salary_max: jobData.salary_max?.S || jobData.salary_max || '',
                            salary_min: jobData.salary_min?.S || jobData.salary_min || '',
                            fit: jobData.fit?.S || jobData.fit || '',
                            location: jobData.location?.S || jobData.location || '',
                            type: jobData.type?.S || jobData.type || '',
                            industry: jobData.industry?.S || jobData.industry || '',
                            deadline: jobData.deadline?.S || jobData.deadline || '',
                            remote: jobData.remote?.S || jobData.remote || '',
                            experience: jobData.experience?.S || jobData.experience || '',
                            source: jobData.source?.S || jobData.source || 'Unknown',
                            url: jobData.url?.S || jobData.url || ''
                        };
                    });

                    // Create welcome message with job recommendations
                    const welcomeMessage: Message = {
                        id: Date.now(),
                        text: `👋 Welcome back! Here are your personalized **${recommendations.jobCategory.replace('-', ' ')}** job recommendations from ${new Date(recommendations.createdAt).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}:`,
                        isUser: false,
                        timestamp: new Date(),
                        jobs: transformedJobs
                    };

                    setMessages([welcomeMessage]);

                } catch (error) {
                    console.error('Failed to load job recommendations:', error);
                    const errorMessage: Message = {
                        id: Date.now(),
                        text: 'Sorry, I couldn\'t load your job recommendations. Please try again or contact support.',
                        isUser: false,
                        timestamp: new Date()
                    };
                    setMessages([errorMessage]);
                } finally {
                    setIsLoadingRecommendations(false);
                }
            }
        };

        loadJobRecommendationsFromUrl();
    }, []); // Only run once on mount

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

        // Starting new request - reset job results flag to re-enable auto-scroll
        setJobResultsReceived(false);

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
        let orchestratorMessageId: number | null = null;  // Separate ID for orchestrator thinking
        let careerAdviceMessageId: number | null = null;  // Separate ID for career advice
        let hasJobResults = false;
        let hasCareerAdvice = false;
        let streamingTimeout: NodeJS.Timeout | null = null;
        let orchestratorStarted = false;
        let waitingForResponse = false;
        let waitingForCareerAdviceResult = false;
        let waitingForJobResult = false;
        let localPendingCareerAdvice: string | null = null; // Local variable for immediate access
        let orchestratorThinking = '';  // Accumulate orchestrator thinking

        try {
            await invokeAgent(currentInput, {
                onThinking: (thinking: string) => {
                    // Show orchestrator thinking in a separate message blob
                    if (!orchestratorStarted) {
                        orchestratorStarted = true;
                        // Turn off typing indicator once we start streaming actual content
                        setIsTyping(false);
                    }

                    // Only accumulate orchestrator thinking if career advice hasn't started
                    if (!waitingForCareerAdviceResult) {
                        orchestratorThinking += thinking;

                        if (orchestratorMessageId === null) {
                            // Create orchestrator thinking message
                            orchestratorMessageId = Date.now() + Math.random();
                            const orchestratorMsg: Message = {
                                id: orchestratorMessageId,
                                text: orchestratorThinking,
                                isUser: false,
                                timestamp: new Date(),
                                isStreaming: true
                            };
                            setMessages(prev => [...prev, orchestratorMsg]);
                        } else {
                            // Use requestAnimationFrame for smoother updates
                            requestAnimationFrame(() => {
                                setMessages(prev =>
                                    prev.map(msg =>
                                        msg.id === orchestratorMessageId
                                            ? { ...msg, text: orchestratorThinking }
                                            : msg
                                    )
                                );
                            });
                        }
                    }
                },

                onJobSearchStarted: () => {
                    waitingForJobResult = true;
                    // Show loading animation on chat body (not in a message)
                    setIsLoadingJobs(true);
                    streamingMessageId = orchestratorMessageId; // Job results will update orchestrator message
                },

                onCareerAdviceStarted: () => {
                    waitingForCareerAdviceResult = true;
                    
                    // Create a new typing indicator message for career advice
                    careerAdviceMessageId = Date.now() + Math.random();
                    const typingMsg: Message = {
                        id: careerAdviceMessageId,
                        text: '',
                        isUser: false,
                        timestamp: new Date(),
                        isStreaming: true,
                        isCareerAdvice: true  // Mark as career advice message
                    };
                    setMessages(prev => [...prev, typingMsg]);
                    
                    // Mark orchestrator message as complete after 2 seconds
                    if (orchestratorMessageId !== null) {
                        setTimeout(() => {
                            setMessages(prev =>
                                prev.map(msg =>
                                    msg.id === orchestratorMessageId
                                        ? { ...msg, isStreaming: false }
                                        : msg
                                )
                            );
                        }, 2000);
                    }
                },

                onCareerAdviceStreaming: (chunk: string) => {
                    // Accumulate streaming chunks for career advice in real-time
                    if (streamingResponse.length > 0) {
                        streamingResponse += chunk;
                    } else {
                        streamingResponse = chunk;
                    }

                    // Update the existing career advice message blob (created by onCareerAdviceStarted)
                    if (careerAdviceMessageId !== null) {
                        // Use requestAnimationFrame for smoother updates
                        requestAnimationFrame(() => {
                            setMessages(prev =>
                                prev.map(msg =>
                                    msg.id === careerAdviceMessageId
                                        ? { ...msg, text: streamingResponse }
                                        : msg
                                )
                            );
                        });
                    }
                },

                onJobResults: (jobs: Job[], responseText: string) => {
                    setIsTyping(false);
                    hasJobResults = true;
                    waitingForJobResult = false;
                    
                    // Stop loading animation and disable auto-scroll
                    setIsLoadingJobs(false);
                    setJobResultsReceived(true); // Disable auto-scroll after job results

                    // Clear any pending streaming timeout
                    if (streamingTimeout) {
                        clearTimeout(streamingTimeout);
                        streamingTimeout = null;
                    }

                    if (jobs && jobs.length > 0) {
                        // Update the orchestrator message with job results
                        if (streamingMessageId) {
                            setMessages(prev =>
                                prev.map(msg =>
                                    msg.id === streamingMessageId
                                        ? {
                                            ...msg,
                                            jobs: jobs,
                                            isStreaming: false
                                        }
                                        : msg
                                )
                            );
                        }
                    }
                },

                onCareerAdvice: (advice: string) => {
                    setIsTyping(false);
                    hasCareerAdvice = true;
                    waitingForCareerAdviceResult = false;

                    // Clear any pending streaming timeout
                    if (streamingTimeout) {
                        clearTimeout(streamingTimeout);
                        streamingTimeout = null;
                    }

                    // If we've been streaming, use the accumulated streamingResponse
                    // Otherwise use the advice parameter (fallback for non-streaming)
                    const finalAdvice = streamingResponse.length > 0 ? streamingResponse : advice;

                    // Use the career advice message ID (separate from orchestrator)
                    if (careerAdviceMessageId === null) {
                        // Fallback: create new message if streaming didn't create one
                        careerAdviceMessageId = Date.now() + Math.random();
                        const careerAdviceMsg: Message = {
                            id: careerAdviceMessageId,
                            text: finalAdvice,
                            isUser: false,
                            timestamp: new Date(),
                            isStreaming: false
                        };
                        setMessages(prev => [...prev, careerAdviceMsg]);
                    } else {
                        // Update the existing career advice message and mark complete
                        setMessages(prev =>
                            prev.map(msg =>
                                msg.id === careerAdviceMessageId
                                    ? { ...msg, text: finalAdvice, isStreaming: false }
                                    : msg
                            )
                        );
                    }
                    
                    // Store the career advice in case sources arrive later
                    localPendingCareerAdvice = finalAdvice;
                    setPendingCareerAdvice(finalAdvice);
                },

                onSources: (sources: Array<{url: string, score: number}>) => {
                    // If we have pending career advice, update the career advice message with sources
                    if (localPendingCareerAdvice) {
                        updateMessageWithCareerAdviceAndSources(localPendingCareerAdvice, sources, careerAdviceMessageId, setMessages);
                        setPendingCareerAdvice(null); // Clear React state
                        localPendingCareerAdvice = null; // Clear local variable
                    } else {
                        // Store sources for later use (e.g., for job results)
                        setCurrentSources(sources);
                    }
                },

                onFinalResult: (result: string) => {
                    // Final result indicates streaming is complete
                    // Mark orchestrator message as complete
                    if (orchestratorMessageId !== null) {
                        setMessages(prev =>
                            prev.map(msg =>
                                msg.id === orchestratorMessageId
                                    ? { ...msg, isStreaming: false }
                                    : msg
                            )
                        );
                    }
                    
                    // Mark career advice message as complete
                    if (careerAdviceMessageId !== null) {
                        setMessages(prev =>
                            prev.map(msg =>
                                msg.id === careerAdviceMessageId
                                    ? { ...msg, isStreaming: false }
                                    : msg
                            )
                        );
                    }
                    
                    // Reset streaming state for next interaction
                    streamingResponse = "";
                    streamingMessageId = null;
                    orchestratorMessageId = null;
                    careerAdviceMessageId = null;
                    orchestratorThinking = "";
                    waitingForResponse = false;
                    waitingForJobResult = false;
                    waitingForCareerAdviceResult = false;
                },

                onResponse: (response: string) => {
                    if (!waitingForResponse && !waitingForCareerAdviceResult && !waitingForJobResult) {
                        waitingForResponse = true;
                    }

                    // Always show response regardless of specialized agents

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
                            // Always show dots for streaming response since we always display it
                            if (streamingMessageId && !hasJobResults && !hasCareerAdvice) {
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
                    console.error('Agent error:', error);
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
                    }
                }
            });

            // Request completed

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
            setIsProcessingComplete(true);
            setCurrentlyStreamingMessageId(null);

            // Clear any pending streaming timeout
            if (streamingTimeout) {
                clearTimeout(streamingTimeout);
                streamingTimeout = null;
            }

            // Clear any pending states
            setCurrentSources([]);
            
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

            {isLoadingRecommendations ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 'calc(100vh - 200px)',
                    gap: '20px'
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '10px'
                    }}>
                        <TypingDot />
                        <TypingDot />
                        <TypingDot />
                    </div>
                    <div style={{
                        fontSize: '1.2em',
                        color: '#8C1D40',
                        fontWeight: 500
                    }}>
                        Loading your job recommendations...
                    </div>
                </div>
            ) : (
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
                                    {message.isCareerAdvice ? <CarrierAvatarImage /> : <BotAvatarImage />}
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
                                        {message.jobs && message.jobs.length > 0 && (
                                            <JobGrid jobs={message.jobs} />
                                        )}
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
                
                {/* Job search loading animation - displayed on chat body */}
                {isLoadingJobs && (
                    <div style={{ 
                        display: 'flex',
                        justifyContent: 'flex-start',
                        paddingLeft: '20px',
                        marginTop: '-80px',  // Reduce gap from message above
                        marginBottom: '-10px'  // Reduce gap to content below
                    }}>
                        <div style={{ 
                            width: '250px', 
                            height: '250px'
                        }}>
                            <DotLottieReact
                                src={loadingAnimation}
                                loop
                                autoplay
                            />
                        </div>
                    </div>
                )}

            </ChatArea>
            )}

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
        </ChatContainer>
    );
};

export default ChatBotPage;