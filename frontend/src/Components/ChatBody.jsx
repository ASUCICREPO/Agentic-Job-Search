import React, { useState, useRef, useEffect } from "react";
import { Grid, Avatar, Typography, Box } from "@mui/material";
import Attachment from "./Attachment";
import ChatInput from "./ChatInput";
import UserAvatar from "../Assets/UserAvatar.svg";
import createMessageBlock from "../utilities/createMessageBlock";
import { ALLOW_FILE_UPLOAD, ALLOW_VOICE_RECOGNITION, ALLOW_FAQ } from "../utilities/constants";
import SpeechRecognitionComponent from "./SpeechRecognition";
import { FAQExamples } from "./index";
import StreamingResponse from "./BotStates/StreamingResponse";
import ThinkingResponse from "./BotStates/ThinkingResponse";
import InitialProcessing from "./BotStates/InitialProcessing";
import { v4 as uuidv4 } from "uuid";
import FileResponse from "./FileResponse";
import bedrockAgentService from "../utilities/bedrockAgentService";
function ChatBody() {
  const [messageList, setMessageList] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [questionAsked, setQuestionAsked] = useState(false);
  const [resumeText, setResumeText] = useState(null); // Store extracted resume text
  const messagesEndRef = useRef(null);
  const currentThinkingText = useRef("");
  const currentToolText = useRef("");

  useEffect(() => {
    scrollToBottom();
    console.log(messageList);
  }, [messageList]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSendMessage = (message) => {
    setProcessing(true);
    currentThinkingText.current = "";
    currentToolText.current = "";

    // Add user message to the list
    const userMessageBlock = createMessageBlock(message, "USER", "TEXT", "SENT");

    // Create a placeholder for bot response
    const botMessageBlock = createMessageBlock("", "BOT", "TEXT", "INITIAL_PROCESSING", [], []);

    setMessageList((prevList) => [...prevList, userMessageBlock, botMessageBlock]);

    // Invoke Bedrock AgentCore
    bedrockAgentService.invokeAgentStreaming(
      message,
      resumeText, // Pass resume text to the service
      // onChunk callback - handles streaming data
      (chunk) => {
        handleStreamingChunk(chunk);
      },
      // onComplete callback
      () => {
        setProcessing(false);
      },
      // onError callback
      (error) => {
        console.error('Bedrock Agent Error:', error);
        setProcessing(false);
        // Update the bot message with error
        setMessageList((prevList) => {
          const lastIndex = prevList.length - 1;
          const updatedList = [...prevList];
          if (lastIndex >= 0 && updatedList[lastIndex].sentBy === "BOT") {
            updatedList[lastIndex] = {
              ...updatedList[lastIndex],
              message: "Sorry, I encountered an error while processing your request. Please try again.",
              state: "RECEIVED",
            };
          }
          return updatedList;
        });
      }
    );

    setQuestionAsked(true);
  };

  const handleFileUploadComplete = (file, fileStatus, extractedText) => {
    // Store the extracted resume text
    if (extractedText) {
      setResumeText(extractedText);
    }

    const userFileMessage = createMessageBlock(`File uploaded: ${file.name}`, "USER", "FILE", "SENT", [], fileStatus);

    setMessageList((prevList) => [...prevList, userFileMessage]);
    setQuestionAsked(true);

    setTimeout(() => {
      let botMessage = "Resume successfully attached to this session! Your resume content will now be used to provide personalized job recommendations.";
      let messageState = "RECEIVED";

      if (fileStatus === "Error processing resume file.") {
        botMessage = "Error processing resume file. Please try uploading again.";
      } else if (fileStatus !== "Resume attached to this session.") {
        botMessage = "Network Error. Please try again later.";
      }

      const botFileMessage = createMessageBlock(botMessage, "BOT", "FILE", messageState, [], fileStatus);

      setMessageList((prevList) => [...prevList, botFileMessage]);
    }, 1000);
  };

  const handlePromptClick = (prompt) => {
    handleSendMessage(prompt);
  };

  const handleStreamingChunk = (chunk) => {
    setMessageList((prevList) => {
      const lastIndex = prevList.length - 1;
      const updatedList = [...prevList];

      if (lastIndex >= 0 && updatedList[lastIndex].sentBy === "BOT") {
        const currentThinking = updatedList[lastIndex].thinking || [];
        
        switch (chunk.type) {
          case 'thinking':
            // Accumulate thinking text until we get a different chunk type
            currentThinkingText.current += chunk.content;
            
            // Update the last thinking entry, or create a new one if this is the first thinking chunk
            if (currentThinking.length === 0 || updatedList[lastIndex].lastChunkType !== 'thinking') {
              // Start new thinking segment
              updatedList[lastIndex] = {
                ...updatedList[lastIndex],
                thinking: [...currentThinking, currentThinkingText.current],
                state: "THINKING",
                lastChunkType: 'thinking'
              };
            } else {
              // Update the last thinking segment
              const newThinking = [...currentThinking];
              newThinking[newThinking.length - 1] = currentThinkingText.current;
              updatedList[lastIndex] = {
                ...updatedList[lastIndex],
                thinking: newThinking,
                state: "THINKING",
                lastChunkType: 'thinking'
              };
            }
            break;

          case 'tool_use':
            // When we get tool_use after thinking, start a new line in thinking
            if (updatedList[lastIndex].lastChunkType === 'thinking') {
              currentThinkingText.current = ""; // Reset for next thinking segment
            }
            
            // Don't show tool usage in the thinking timeline - keep state as THINKING
            updatedList[lastIndex] = {
              ...updatedList[lastIndex],
              state: "THINKING", // Keep thinking state
              lastChunkType: 'tool_use'
            };
            break;

          case 'response':
            // When we get response after thinking/tool_use, start a new line in thinking
            if (updatedList[lastIndex].lastChunkType === 'thinking') {
              currentThinkingText.current = ""; // Reset for next thinking segment
            }
            
            // Don't show response chunks - keep state as THINKING until final_result
            updatedList[lastIndex] = {
              ...updatedList[lastIndex],
              state: "THINKING", // Keep thinking state until final_result
              lastChunkType: 'response'
            };
            break;

          case 'final_result':
            // Final response - use this as the complete message
            updatedList[lastIndex] = {
              ...updatedList[lastIndex],
              message: chunk.content,
              state: "RECEIVED",
              lastChunkType: 'final_result'
            };
            // Reset thinking text accumulator
            currentThinkingText.current = "";
            break;

          default:
            console.log('Unknown chunk type:', chunk.type);
        }
      }
      return updatedList;
    });
  };

  // Initialize Bedrock Agent Service on component mount
  useEffect(() => {
    console.log("ChatBody component initialized with Bedrock AgentCore");
    
    // Cleanup function (if needed)
    return () => {
      console.log("ChatBody component unmounted");
    };
  }, []);

  const getMessage = () => message;

  return (
    <>
      <Box display="flex" flexDirection="column" justifyContent="space-between" className="appHeight100 appWidth100">
        <Box className="chatScrollContainer appWidth100">
          <Box sx={{ display: ALLOW_FAQ ? "flex" : "none" }}>{!questionAsked && <FAQExamples onPromptClick={handlePromptClick} />}</Box>
          {messageList.map((msg, index) => (
            <Box key={index} mb={2}>
              {/* Case 1: If the message type is "file", handle it separately */}
              {msg.type === "FILE" ? (
                <FileResponse message={msg} />
              ) : // Case 2: Handle non-file messages (both User and Bot)

              // If the message is from the User:
              msg.sentBy === "USER" ? (
                <UserReply message={msg.message} type={msg.type} fileName={msg.fileName} />
              ) : (
                // If the message is from the Bot:
                msg.sentBy === "BOT" &&
                // Case 3: Bot message states (Initial, Thinking, Streaming)
                (msg.state === "INITIAL_PROCESSING" ? (
                  // Bot is in the initial processing state
                  <InitialProcessing />
                ) : msg.state === "THINKING" ? (
                  // Bot is thinking (waiting for response)
                  <ThinkingResponse message={msg} postThinking={msg.lastChunkType === 'final_result'} />
                ) : (
                  // Bot has finished streaming the response
                  <StreamingResponse message={msg} />
                ))
              )}
            </Box>
          ))}

          <div ref={messagesEndRef} />
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="flex-end" sx={{ flexShrink: 0 }}>
          <Box sx={{ display: ALLOW_VOICE_RECOGNITION ? "flex" : "none" }}>
            <SpeechRecognitionComponent setMessage={setMessage} getMessage={getMessage} />
          </Box>
          <Box sx={{ display: ALLOW_FILE_UPLOAD ? "flex" : "none" }} mr={2}>
            <Attachment onFileUploadComplete={handleFileUploadComplete} />
          </Box>
          <Box sx={{ width: "100%" }}>
            <ChatInput onSendMessage={handleSendMessage} processing={processing} message={message} setMessage={setMessage} />
          </Box>
        </Box>
      </Box>
    </>
  );
}

export default ChatBody; // User reply component
function UserReply({ message, type, fileName }) {
  return (
    <Grid container direction="row" justifyContent="flex-end" alignItems="flex-end">
      <Grid item className="userMessage" sx={{ backgroundColor: (theme) => theme.palette.background.userMessage }}>
        <Typography variant="body2">{type === "FILE" ? `File uploaded: ${fileName}` : message}</Typography>
      </Grid>
      <Grid item>
        <Avatar alt={"User Profile Pic"} src={UserAvatar} />
      </Grid>
    </Grid>
  );
}
