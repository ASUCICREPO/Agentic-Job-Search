import React, { useState } from "react";
import { Box, Typography, Grid, Avatar,  } from "@mui/material";
import BotAvatar from "../Assets/BotAvatar.png"; // Adjust the path based on your file structure
import UserAvatar from "../Assets/UserAvatar.svg"; // Adjust the path based on your file structure

// Import Icons from the /Assets/Icons folder
import csvIcon from "../Assets/Icons/CSV.png";
import docIcon from "../Assets/Icons/DOC.png";
import gifIcon from "../Assets/Icons/GIFF.png";
import htmlIcon from "../Assets/Icons/HTML.png";
import jpgIcon from "../Assets/Icons/JPG.png";
import movIcon from "../Assets/Icons/MOV.png";
import mp3Icon from "../Assets/Icons/MP3.png";
import mp4Icon from "../Assets/Icons/MP4.png";
import pdfIcon from "../Assets/Icons/PDF.png";
import pngIcon from "../Assets/Icons/PNG.png";
import pptIcon from "../Assets/Icons/PPT.png";
import txtIcon from "../Assets/Icons/TXT.png";
import xlsIcon from "../Assets/Icons/XLSX.png";

// Mapping file extensions to Icons
const getFileIcon = (fileType) => {
  switch (fileType.toLowerCase()) {
    case "csv":
      return csvIcon;
    case "doc":
      return docIcon;
    case "gif":
      return gifIcon;
    case "html":
      return htmlIcon;
    case "jpg":
    case "jpeg":
      return jpgIcon;
    case "mov":
      return movIcon;
    case "mp3":
      return mp3Icon;
    case "mp4":
      return mp4Icon;
    case "pdf":
      return pdfIcon;
    case "png":
      return pngIcon;
    case "ppt":
      return pptIcon;
    case "txt":
      return txtIcon;
    case "xls":
      return xlsIcon;
    case "xlsx":
      return xlsIcon;
    default:
      return pngIcon; // Default icon for unrecognized file types
  }
};

const FileHandler = ({ message }) => {
  // eslint-disable-next-line
  const [hoveredFile, setHoveredFile] = useState(null);
  const handlePreview = (file) => {
    const byteCharacters = atob(file.base64);
    const byteArrays = [];

    for (let i = 0; i < byteCharacters.length; i++) {
      byteArrays.push(byteCharacters.charCodeAt(i));
    }

    const byteArray = new Uint8Array(byteArrays);
    const blob = new Blob([byteArray], { type: file.type });
    const blobUrl = URL.createObjectURL(blob);

    // Open the blob URL in a new tab
    const newWindow = window.open(blobUrl, "_blank");
    if (newWindow) {
      newWindow.focus();
    } else {
      alert("Please allow pop-ups to view the file.");
    }

    // Revoke object URL after some time to free memory
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  };

  const handleDownload = (file) => {
    // Trigger file download
    const fileUrl = `data:${file.type};base64,${file.base64}`;
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = file.filename;
    link.click();
  };

  return (
    <Grid item container direction="column" spacing={1} xs={8}>
      {message.files && Array.isArray(message.files) && message.files.length > 0 ? (
        message.files.map((file, index) => (
          <Grid item key={index} onMouseEnter={() => setHoveredFile(index)} onMouseLeave={() => setHoveredFile(null)} justifyItems={message.sentBy === "USER" ? "end" : "start"} sx={{ mr: 1 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                width: "fit-content", // Ensures the Box width fits the content inside
                padding: "0.5rem 0.5rem", // Adds padding
                border: "1px solid", // Adds a grey border
                borderColor: (theme) => theme.palette.background.header,
                borderRadius: "4px", // Rounds the corners with a 4px radius
                cursor: "pointer",
                background: (theme) => theme.palette.background.chatLeftPanel,
              }}
              onClick={() => {
                if (file.type.startsWith("image")) {
                  handlePreview(file);
                } else {
                  handleDownload(file);
                }
              }}
            >
              {/* File Icon */}
              <Box sx={{ marginRight: 1 }}>
                <img
                  src={getFileIcon(file.filename.split(".").pop())}
                  alt={file.filename}
                  style={{
                    height: "2rem",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                />
              </Box>
              <Box>
                <Typography variant="body2">{file.filename}</Typography>
                {/* Displaying image files directly in the UI */}
                {file.type.startsWith("image") && <img src={`data:${file.type};base64,${file.base64}`} alt={file.filename} style={{ maxWidth: "100px", maxHeight: "100px", marginTop: "8px" }} />}
              </Box>
            </Box>
          </Grid>
        ))
      ) : (
        <Grid item>
          <Typography variant="body2">{message.message}</Typography>
        </Grid>
      )}
    </Grid>
  );
};

const FileResponse = ({ message }) => {
  return <>{message.sentBy === "BOT" ? <BotFile message={message} /> : <UserFile message={message} />}</>;
};
export default FileResponse;

const UserFile = ({ message }) => {
  return (
    <Grid container direction="row" justifyContent="flex-end" alignItems="flex-end">
      {message.files && Array.isArray(message.files) && message.files.length > 0 ? (
        <FileHandler message={message} />
      ) : (
        <Grid item className="userMessage" sx={{ backgroundColor: (theme) => theme.palette.background.userMessage }}>
          <Typography variant="body2">{message.message}</Typography>
        </Grid>
      )}
      <Grid item>
        <Avatar alt={"User Profile Pic"} src={UserAvatar} />
      </Grid>
    </Grid>
  );
};

const BotFile = ({ message }) => {
  return (
    <Grid container direction="row" justifyContent="flex-start" alignItems="flex-end">
      {/* Avatar on the left */}
      <Grid item>
        <Avatar alt="Bot Avatar" src={BotAvatar} sx={{ mr: 1 }} />
      </Grid>
      {message.files && Array.isArray(message.files) && message.files.length > 0 ? (
        <FileHandler message={message} />
      ) : (
        <Grid item container direction="column" sx={{ flex: 1 }}>
          <Grid item container alignItems="center">
            <Grid item className="botMessage" sx={{ backgroundColor: (theme) => theme.palette.background.botMessage }}>
              <Typography variant="body2">{message.message}</Typography>
            </Grid>
          </Grid>
        </Grid>
      )}
    </Grid>
  );
};
