const { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } = require('@aws-sdk/client-bedrock-agentcore');

// Initialize Bedrock AgentCore client
const bedrockClient = new BedrockAgentCoreClient();

// Get environment variables
const AGENT_RUNTIME_ARN = process.env.AGENT_RUNTIME_ARN;
const AGENT_QUALIFIER = process.env.AGENT_QUALIFIER || 'DEFAULT';

exports.handler = awslambda.streamifyResponse(
    async (event, responseStream, _context) => {
        try {
            // Parse request body
            let body;
            if (event.body) {
                body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
            } else {
                body = event;
            }

            // Extract parameters
            const runtimeSessionId = body.runtimeSessionId;
            const payload = body.payload;

            // Validation
            if (!runtimeSessionId || !payload) {
                const errorMsg = JSON.stringify({
                    error: 'Missing runtimeSessionId or payload'
                });

                responseStream = awslambda.HttpResponseStream.from(responseStream, {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                responseStream.write(errorMsg);
                responseStream.end();
                await responseStream.finished();
                return;
            }

            // Convert payload to bytes
            let payloadBytes;
            if (typeof payload === 'object') {
                payloadBytes = Buffer.from(JSON.stringify(payload), 'utf-8');
            } else if (typeof payload === 'string') {
                payloadBytes = Buffer.from(payload, 'utf-8');
            } else {
                payloadBytes = payload;
            }

            console.log(`Invoking AgentCore with session ID: ${runtimeSessionId}`);

            // Set response metadata
            responseStream = awslambda.HttpResponseStream.from(responseStream, {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/octet-stream'
                }
            });

            // Invoke Bedrock AgentCore with streaming
            const command = new InvokeAgentRuntimeCommand({
                runtimeSessionId: runtimeSessionId,
                agentRuntimeArn: AGENT_RUNTIME_ARN,
                qualifier: AGENT_QUALIFIER,
                payload: payloadBytes
            });

            const response = await bedrockClient.send(command);

            // Get the streaming response
            const eventStream = response.response;

            if (!eventStream) {
                const errorMsg = JSON.stringify({ error: 'No response stream from AgentCore' });
                responseStream.write(errorMsg);
                responseStream.end();
                await responseStream.finished();
                return;
            }

            console.log("Starting direct streaming of AgentCore response");

            // Stream chunks directly as received from AgentCore - eventStream is an async iterator
            for await (const chunk of eventStream) {
                // Write chunk bytes directly to response stream
                if (chunk.chunk?.bytes) {
                    responseStream.write(Buffer.from(chunk.chunk.bytes));
                } else if (chunk.bytes) {
                    responseStream.write(Buffer.from(chunk.bytes));
                } else {
                    // Fallback: try to write the chunk as-is if it's already bytes
                    responseStream.write(chunk);
                }
            }

            console.log("Direct streaming complete");
            responseStream.end();
            await responseStream.finished();

        } catch (error) {
            console.error('Error in streaming response:', error);

            // Send error to client
            const errorMsg = JSON.stringify({ error: error.message || String(error) });

            responseStream = awslambda.HttpResponseStream.from(responseStream, {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            responseStream.write(errorMsg);
            responseStream.end();
            await responseStream.finished();
        }
    }
);