import styled from 'styled-components';

export const ChatContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f0f0;
`;

export const Header = styled.div`
  background: white;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
`;

export const ASULogoContainer = styled.div`
  display: flex;
  align-items: center;
`;

export const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1;
`;

export const WelcomeSection = styled.div`
  display: flex;
  flex-direction: column;
`;

export const WelcomeTitle = styled.h1`
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
`;

export const UserGreeting = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 0.9rem;
  margin-top: 5px;
`;

export const UserIcon = styled.div`
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
`;

export const ProfileButton = styled.button`
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

export const ChatArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export const MessageContainer = styled.div<{ $isUser: boolean }>`
  display: flex;
  justify-content: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  align-items: flex-start;
  gap: 10px;
`;

export const BotMessageWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 65%;
`;

export const BotContentWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

export const BotMessageBubble = styled.div`
  background: linear-gradient(135deg, #FFF9C4 0%, #FFC627 100%);
  padding: 15px 20px;
  border-radius: 20px;
  color: #333;
  font-size: 0.95rem;
  line-height: 1.4;
  position: relative;
`;

export const UserMessageWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  max-width: 60%;
`;

export const UserAvatarContainer = styled.div`
  margin-left: 10px;
`;

export const UserMessageBubble = styled.div`
  background: linear-gradient(135deg, #e1bee7 0%, #b3e5fc 100%);
  padding: 15px 20px;
  border-radius: 20px;
  color: #333;
  font-size: 0.95rem;
  line-height: 1.4;
  margin-bottom: 5px;
`;

export const Timestamp = styled.div`
  font-size: 0.8rem;
  color: #666;
  margin-top: 5px;
`;

export const InputContainer = styled.div`
  padding: 20px 80px 50px 80px;
  background: #f0f0f0;
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

export const InputWrapper = styled.div`
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

export const Input = styled.input`
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

export const SendButton = styled.button`
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

export const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 15px 20px;
  background: linear-gradient(135deg, #FFF9C4 0%, #FFC627 100%);
  border-radius: 20px;
  max-width: 65%;
`;

export const TypingDot = styled.div`
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

export const SourcesToggleButton = styled.button`
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

export const SourcesContainer = styled.div<{ $isExpanded: boolean }>`
  max-height: ${props => props.$isExpanded ? '300px' : '0px'};
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  margin-top: 12px;
  opacity: ${props => props.$isExpanded ? '1' : '0'};
`;

export const SourcesList = styled.div`
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

export const SourceLink = styled.a`
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
