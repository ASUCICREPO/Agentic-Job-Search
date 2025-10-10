import React from 'react';
import asuLogo from '../assets/asu-logo.png';
import botAvatar from '../assets/bot-avatar.png';
import carrierLogo from '../assets/carrier-logo.png';
import userAvatar from '../assets/my_profile.png';

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

export const CarrierAvatarImage: React.FC<{ className?: string }> = ({ className }) => (
  <img 
    src={carrierLogo} 
    alt="Career Advisor Avatar" 
    className={className} 
    style={{
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      objectFit: 'cover'
    }} 
  />
);