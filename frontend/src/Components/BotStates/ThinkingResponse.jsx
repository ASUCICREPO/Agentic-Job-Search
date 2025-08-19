import React, { useEffect, useRef, useState } from "react";
import { Grid, Avatar, Typography, Collapse, IconButton } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import BotAvatar from "../../Assets/BotAvatar.png";
import { Timeline } from "antd"; // Import Ant Design Timeline component
import { BlinkingDot } from "./InitialProcessing";
import theme from "../../theme";

const ThinkingResponse = ({ message }) => {
  return (
    <Grid container direction="row" justifyContent="flex-start" alignItems="flex-end">
      <Grid item>
        <Avatar alt="Bot Avatar" src={BotAvatar} sx={{ mr: 1 }} />
      </Grid>
      <ThinkingContainer message={message} />
    </Grid>
  );
};

export default ThinkingResponse;

export const ThinkingContainer = ({ message, postThinking }) => {
  const dotRef = useRef(null);
  const [expanded, setExpanded] = useState(!postThinking);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  useEffect(() => {
    const dotAnimation = setInterval(() => {
      if (dotRef.current) {
        const currentText = dotRef.current.textContent;
        dotRef.current.textContent = currentText.length >= 3 ? "" : currentText + ".";
      }
    }, 500);

    return () => clearInterval(dotAnimation);
  }, []);

  return (
    <Grid item container direction="column" sx={{ flex: 1 }}>
      <Grid item container alignItems="center">
        <IconButton onClick={handleExpandClick} aria-expanded={expanded} aria-label="show more" size="small">
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>{" "}
        {postThinking ? (
          <div className="analysedText">Analyzed</div>
        ) : (
          <div className="analysedText thinkingAnimatedText">
            Analyzing
            <span ref={dotRef}></span>
          </div>
        )}
      </Grid>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Grid item className="thinkingMessage" sx={{ border: (theme) => `1px solid ${theme.palette.background.botMessage}`, mt: 1, p: 1, borderRadius: 1 }}>
          <Timeline 
            mode="left"
            items={
              Array.isArray(message.thinking) 
                ? message.thinking.map((think, index) => ({
                    key: index,
                    color: theme.palette.primary.main,
                    children: (
                      <Typography sx={{ fontFamily: "monospace", fontSize: 12 }}>
                        {think}
                      </Typography>
                    )
                  }))
                : []
            }
          />
          {!postThinking && <BlinkingDot />}
        </Grid>
      </Collapse>
    </Grid>
  );
};
