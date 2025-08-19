import React, { useState } from "react";
import { Grid, Button, CircularProgress } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import pdfToText from 'react-pdftotext';

function Attachment({ onFileUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      setUploadStatus("Please select a PDF file only.");
      onFileUploadComplete(file, "Invalid file type. Please upload a PDF file.");
      return;
    }

    setUploading(true);
    setUploadStatus("");

    try {
      // Extract text from PDF using react-pdftotext
      const resumeText = await pdfToText(file);
      
      setUploadStatus("Resume processed successfully!");
      // Pass the extracted text along with file info
      onFileUploadComplete(file, "Resume attached to this session.", resumeText);
    } catch (error) {
      console.error('Error processing file:', error);
      setUploadStatus("Error processing file.");
      onFileUploadComplete(file, "Error processing resume file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Grid container direction="column" alignItems="flex-end" justifyContent="center">
      <Grid item xs={12}>
        <Button component="label" className="attachmentButton">
          <AttachFileIcon />
          <input type="file" accept="application/pdf" hidden onChange={handleFileUpload} />
          {uploading && <CircularProgress size={24} />}
        </Button>
      </Grid>
    </Grid>
  );
}

export default Attachment;
