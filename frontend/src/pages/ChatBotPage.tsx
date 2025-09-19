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



interface Message {
    id: number;
    text: string;
    isUser: boolean;
    timestamp: Date;
    hasJobButton?: boolean;
    jobQuery?: string;
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

const ChatBotPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const userName = location.state?.userName || "User";
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isSpecialTyping, setIsSpecialTyping] = useState(false);
    const [isProcessingComplete, setIsProcessingComplete] = useState(true);
    const [currentlyStreamingMessageId, setCurrentlyStreamingMessageId] = useState<number | null>(null);
    const [showJobPopup, setShowJobPopup] = useState(false);
    const [jobs, setJobs] = useState<Job[]>([]);
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

        try {
            await invokeAgent(currentInput, {
                onThinking: (thinking: string) => {
                    // Agent thinking - no logging needed
                },

                onJobSearchStarted: () => {
                    // Job search started - no logging needed
                },

                onCareerAdviceStarted: () => {
                    // Career advice started - no logging needed
                },

                onJobResults: (jobs: Job[], responseText: string) => {
                    setIsTyping(false);
                    hasJobResults = true;

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
                    setIsTyping(false);
                    hasCareerAdvice = true;

                    // Clear any pending streaming timeout
                    if (streamingTimeout) {
                        clearTimeout(streamingTimeout);
                        streamingTimeout = null;
                    }

                    // Update the existing streaming message with career advice
                    if (streamingMessageId) {
                        setMessages(prev =>
                            prev.map(msg =>
                                msg.id === streamingMessageId
                                    ? {
                                        ...msg,
                                        text: advice
                                    }
                                    : msg
                            )
                        );
                    } else {
                        // Fallback: create new message if no streaming message exists
                        const botMessage: Message = {
                            id: Date.now() + Math.random(),
                            text: advice,
                            isUser: false,
                            timestamp: new Date()
                        };
                        setMessages(prev => [...prev, botMessage]);
                    }
                },

                onResponse: (response: string) => {
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
                            // Only show dots if this message is still the current streaming message
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
                    } else if (!error.includes("Error processing request: 'output'")) {
                        // Ignoring backend processing error - job results already received
                    }
                }
            });


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
            setIsProcessingComplete(true);
            setCurrentlyStreamingMessageId(null);

            // Clear any pending streaming timeout
            if (streamingTimeout) {
                clearTimeout(streamingTimeout);
                streamingTimeout = null;
            }
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