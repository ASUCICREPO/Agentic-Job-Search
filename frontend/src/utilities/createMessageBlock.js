/**
 * Function to create a message block with consistent structure and validation.
 *
 * @param {string} message - The content of the message.
 * @param {string} sentBy - The sender of the message ('USER' or 'BOT').
 * @param {string} [type='TEXT'] - The type of the message ('TEXT' or 'FILE').
 * @param {string} [state='THINKING'] - This is when the bot is thinking of the prompt.
 * @param {string} [state='INITIAL_PROCESSING'] - The state of the message ('INITIAL_PROCESSING' or 'RECEIVED' or 'SENT' or 'STREAMING').
 * @param {string} [fileName=''] - The name of the file (if type is 'FILE').
 * @param {string} [fileStatus=''] - The status of the file (if type is 'FILE').
 * @param {string} [files=[]] - List of Files.
 * @param {string} [files=[ { // expected format
              filename: "abc.csv",
              type: "text/csv",
              link:"",
              base64:
                "Rmlyc3ROYW1lLExhc3ROYW1lClBFRFJPLEFHVUlMQVIKg==",
            },]] - List of Files.
 * 
 * @returns {Object} - A message block object.
 * @throws Will throw an error if sentBy, type, or state are invalid.
 */
const createMessageBlock = (message, sentBy, type = "TEXT", state = "INITIAL_PROCESSING", files = [], thinking = "") => {
  // Valid sender types
  const validSenders = ["USER", "BOT"];
  // Valid message types
  const validTypes = ["TEXT", "FILE"];
  // Valid message states
  const validStates = ["INITIAL_PROCESSING", "RECEIVED", "SENT", "STREAMING", "THINKING"];

  // Validate the 'sentBy' parameter
  if (!validSenders.includes(sentBy)) {
    throw new Error("Invalid sender. Must be 'USER' or 'BOT'.");
  }

  // Validate the 'type' parameter
  if (!validTypes.includes(type)) {
    throw new Error("Invalid message type. Must be 'TEXT' or 'FILE'.");
  }

  // Validate the 'state' parameter
  if (!validStates.includes(state)) {
    throw new Error("Invalid state. Must be 'INITIAL_PROCESSING', 'RECEIVED', 'SENT', or 'STREAMING'.");
  }

  // Return the message block object
  return {
    message,
    sentBy,
    type,
    state,
    files,

    thinking,
  };
};

export default createMessageBlock;
