import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ASULogoImage, UserAvatarImage, BotAvatarImage } from '../components/ImageAssets';
import { invokeAgent } from '../services/agentService';
import JobGrid from '../components/JobGrid';
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
    const userName = location.state?.userName || "User";
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isProcessingComplete, setIsProcessingComplete] = useState(true);
    const [currentlyStreamingMessageId, setCurrentlyStreamingMessageId] = useState<number | null>(null);
    const [currentSources, setCurrentSources] = useState<Array<{url: string, score: number}>>([]);
    const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

        // Starting new request

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
        let streamingTimeout: NodeJS.Timeout | null = null;
        let orchestratorStarted = false;
        let waitingForResponse = false;
        let waitingForCareerAdviceResult = false;
        let waitingForJobResult = false;
        let localPendingCareerAdvice: string | null = null; // Local variable for immediate access

        try {
            await invokeAgent(currentInput, {
                onThinking: (thinking: string) => {
                    if (!orchestratorStarted) {
                        orchestratorStarted = true;
                    }
                    // Ignore thinking chunks - only process response chunks
                },

                onJobSearchStarted: () => {
                    waitingForJobResult = true;
                },

                onCareerAdviceStarted: () => {
                    waitingForCareerAdviceResult = true;
                },

                onJobResults: (jobs: Job[], responseText: string) => {
                    setIsTyping(false);
                    hasJobResults = true;
                    waitingForJobResult = false;

                    // Clear any pending streaming timeout
                    if (streamingTimeout) {
                        clearTimeout(streamingTimeout);
                        streamingTimeout = null;
                    }

                    if (jobs && jobs.length > 0) {
                        // Update the existing streaming message with job results, keeping original text
                        if (streamingMessageId) {
                            setMessages(prev =>
                                prev.map(msg =>
                                    msg.id === streamingMessageId
                                        ? {
                                            ...msg,
                                            jobs: jobs
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
                                jobs: jobs
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
                    setIsTyping(false);
                    hasCareerAdvice = true;
                    waitingForCareerAdviceResult = false;

                    // Clear any pending streaming timeout
                    if (streamingTimeout) {
                        clearTimeout(streamingTimeout);
                        streamingTimeout = null;
                    }

                    // Store the career advice and check if we have sources ready
                    localPendingCareerAdvice = advice;
                    setPendingCareerAdvice(advice);

                    // If we already have sources, update the message now
                    if (currentSources.length > 0) {
                        updateMessageWithCareerAdviceAndSources(advice, currentSources, streamingMessageId, setMessages);
                        setCurrentSources([]); // Clear sources for next request
                        setPendingCareerAdvice(null); // Clear React state
                        localPendingCareerAdvice = null; // Clear local variable
                    }
                    // If no sources yet, wait for onSources callback
                },

                onSources: (sources: Array<{url: string, score: number}>) => {
                    setCurrentSources(sources);

                    // If we have pending career advice, update the message now
                    if (localPendingCareerAdvice) {
                        updateMessageWithCareerAdviceAndSources(localPendingCareerAdvice, sources, streamingMessageId, setMessages);
                        setCurrentSources([]); // Clear sources for next request
                        setPendingCareerAdvice(null); // Clear React state
                        localPendingCareerAdvice = null; // Clear local variable
                    }
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
        </ChatContainer>
    );
};

export default ChatBotPage;