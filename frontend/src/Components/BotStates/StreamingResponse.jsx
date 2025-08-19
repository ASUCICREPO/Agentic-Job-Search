import React from "react";
import { Grid, Avatar } from "@mui/material";
import BotAvatar from "../../Assets/BotAvatar.png";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { ThinkingContainer } from "./ThinkingResponse";
import { BlinkingDot } from "./InitialProcessing";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw"; // Add rehype-raw for processing raw HTML

const StreamingResponse = ({ message }) => {
  return (
    <Grid container direction="row" justifyContent="flex-start" alignItems="flex-end">
      <Grid item>
        <Avatar alt="Bot Avatar" src={BotAvatar} />
      </Grid>
      <Grid item container direction="column" sx={{ flex: 1 }} spacing={2}>
        {message.thinking && <ThinkingContainer message={message} postThinking={true} />}
        <Grid item container alignItems="center">
          <Grid item className="botMessage" sx={{ backgroundColor: (theme) => theme.palette.background.botMessage }}>
            <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {message.message}
            </ReactMarkdown>
            {message.state === "STREAMING" && <BlinkingDot />}
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
};

export default StreamingResponse;
