import React from 'react';
import asuLogo from '../assets/images/asu-logo.png';
import botAvatar from '../assets/images/bot-avatar.png';
import userAvatar from '../assets/images/user-avatar.png';

export const ASULogoImage: React.FC<{ className?: string }> = ({ className }) => (
  <img 
    src={asuLogo} 
    alt="ASU Logo" 
    className={className} 
    style={{
      height: '40px',
      width: 'auto',
      objectFit: 'contain'
    }} 
  />
);

export const UserAvatarImage: React.FC<{ className?: string }> = ({ className }) => (
  <img 
    src={userAvatar} 
    alt="User Avatar" 
    className={className} 
    style={{
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      objectFit: 'cover'
    }} 
  />
);

export const BotAvatarImage: React.FC<{ className?: string }> = ({ className }) => (
  <img 
    src={botAvatar} 
    alt="Bot Avatar" 
    className={className} 
    style={{
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      objectFit: 'cover'
    }} 
  />
);

// Instructions for adding custom images:
/*
1. Add your image files to src/assets/images/
   - asu-logo.png (for ASU logo)
   - user-avatar.jpg (for user profile picture)
   - bot-avatar.png (for chatbot avatar)

2. Import them at the top of this file:
   import asuLogo from '../assets/images/asu-logo.png';

3. Replace the placeholder components with img tags:
   export const ASULogoImage: React.FC<{ className?: string }> = ({ className }) => (
     <img src={asuLogo} alt="ASU Logo" className={className} />
   );

4. Update the ChatBotPage.tsx to use these components instead of the current placeholders
*/