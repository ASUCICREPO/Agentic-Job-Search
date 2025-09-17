# ASU Job Search Chatbot

A React.js frontend application that replicates the Figma design for ASU Career Services with an intelligent chatbot interface.

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation
1. Navigate to the project directory:
   ```bash
   cd asu-job-search
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## 🎨 Customizing Images and Logos

### Method 1: Replace Image Components (Recommended)

1. **Add your image files** to `src/assets/images/`:
   - `asu-logo.png` - ASU logo (recommended size: 120x80px)
   - `user-avatar.jpg` - User profile picture (recommended size: 80x80px)
   - `bot-avatar.png` - Chatbot avatar (recommended size: 80x80px)

2. **Update `src/components/ImageAssets.tsx`**:
   ```tsx
   // Add imports at the top
   import asuLogo from '../assets/images/asu-logo.png';
   import userAvatar from '../assets/images/user-avatar.jpg';
   import botAvatar from '../assets/images/bot-avatar.png';

   // Replace the placeholder components
   export const ASULogoImage: React.FC<{ className?: string }> = ({ className }) => (
     <img src={asuLogo} alt="ASU Logo" className={className} style={{height: '40px'}} />
   );

   export const UserAvatarImage: React.FC<{ className?: string }> = ({ className }) => (
     <img src={userAvatar} alt="User Avatar" className={className} style={{width: '40px', height: '40px', borderRadius: '50%'}} />
   );

   export const BotAvatarImage: React.FC<{ className?: string }> = ({ className }) => (
     <img src={botAvatar} alt="Bot Avatar" className={className} style={{width: '40px', height: '40px', borderRadius: '50%'}} />
   );
   ```

### Method 2: Direct Styling Changes

You can also modify the placeholder styles directly in `src/components/ImageAssets.tsx` to change colors, gradients, or emoji icons.

## 🤖 Chatbot Features

The chatbot responds intelligently to various topics:

- **Part-time jobs**: "Are there part-time jobs on campus?"
- **Remote work**: "What remote jobs can I do while studying?"
- **Internships**: "How do I find internships?"
- **Resume help**: "Can you help with my resume?"
- **Interview prep**: "How do I prepare for interviews?"
- **Salary questions**: "What should I expect for pay?"
- **Networking**: "How do I network effectively?"

### Adding New Responses

Edit the `getAIResponse` function in `src/pages/ChatBotPage.tsx` to add new question patterns and responses.

## 📱 Project Structure

```
src/
├── components/
│   ├── ImageAssets.tsx      # Customizable image components
│   └── LoadingSpinner.tsx   # Loading animation
├── pages/
│   ├── ProfilePage.tsx      # User profile setup page
│   ├── JobOptionsPage.tsx   # Job search options page
│   └── ChatBotPage.tsx      # Main chatbot interface
├── assets/
│   └── images/              # Place your custom images here
└── App.tsx                  # Main app routing
```

## 🎯 Key Features

- **Responsive Design**: Works on desktop and mobile
- **ASU Brand Colors**: Maroon (#8B1538) and Gold (#FFC627)
- **Real-time Chat**: Typing indicators and timestamps
- **Intelligent Responses**: Context-aware chatbot replies
- **Easy Customization**: Simple image replacement system

## 🔧 Available Scripts

- `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm run eject` - Ejects from Create React App (not recommended)

## 📝 Notes

- The chatbot currently uses simulated responses. For production, integrate with a real AI service.
- Images are currently placeholders. Follow the customization guide above to add real images.
- The design matches the provided Figma specifications exactly.

## 🎨 Design Credits

Based on the ASU Job Search Figma design for the ASU AI Conference.