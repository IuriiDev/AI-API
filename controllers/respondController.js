/**
 * Respond Controller
 * 
 * Unified AI response endpoint supporting:
 * - Synchronous responses
 * - Streaming via SSE
 * - Background job execution
 * 
 * Accepts both:
 * - input: string (simple user text)
 * - messages: array (full conversation history for iOS app compatibility)
 */

const { getProvider } = require('../providers');
const { APIError } = require('../middleware/errorHandler');
const config = require('../config');
const jobStore = require('../utils/jobStore');

/**
 * Generate unique request ID for logging
 */
function generateRequestId() {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log request (without user content by default)
 */
function logRequest(requestId, action, details = {}) {
    const logEntry = {
        requestId,
        action,
        timestamp: new Date().toISOString(),
        ...details
    };

    // Don't log user content unless explicitly enabled
    if (!config.logging.logUserContent) {
        delete logEntry.input;
        delete logEntry.messages;
    }

    console.log(`[${logEntry.timestamp}] ${action}:`, JSON.stringify(logEntry));
}

/**
 * Extract output text from OpenAI response
 * Helper function for consistent text extraction
 */
function extractOutputText(response) {
    return response?.content ||
        response?.choices?.[0]?.message?.content ||
        null;
}

/**
 * POST /ai/respond
 * 
 * Body (option 1 - simple):
 * - input: string (user text)
 * 
 * Body (option 2 - conversation, iOS app compatible):
 * - messages: array of { role, content }
 * 
 * Common options:
 * - model: string (optional)
 * - stream: boolean (optional, default: false)
 * - background: boolean (optional, default: false)
 * - provider: string (optional, default: 'openai')
 * - image: string (optional, base64 encoded image)
 */
async function handleRespond(req, res) {
    const requestId = generateRequestId();
    const {
        input,
        messages: inputMessages,
        model,
        stream = false,
        background = false,
        provider: providerName = 'openai',
        image
    } = req.body;

    // Accept either 'input' (simple string) or 'messages' (conversation array)
    let messages;

    if (inputMessages && Array.isArray(inputMessages) && inputMessages.length > 0) {
        // iOS app format: messages array
        messages = inputMessages;
    } else if (input && typeof input === 'string') {
        // Simple format: just input string
        const trimmedInput = input.trim();

        if (trimmedInput.length < config.validation.minInputLength) {
            throw new APIError('Invalid request: input cannot be empty', 400);
        }

        if (trimmedInput.length > config.validation.maxInputLength) {
            throw new APIError(
                `Invalid request: input exceeds maximum length of ${config.validation.maxInputLength} characters`,
                400
            );
        }

        messages = [{ role: 'user', content: trimmedInput }];
    } else {
        throw new APIError('Invalid request: either input string or messages array is required', 400);
    }

    logRequest(requestId, 'REQUEST_RECEIVED', {
        model,
        stream,
        background,
        provider: providerName,
        messageCount: messages.length,
        hasImage: !!image
    });

    const provider = getProvider(providerName);

    // Background mode: create job and return immediately
    if (background) {
        return handleBackgroundJob(req, res, { requestId, messages, model, provider, image });
    }

    // Streaming mode: SSE response
    if (stream) {
        return handleStreamingResponse(req, res, { requestId, messages, model, provider, image });
    }

    // Synchronous mode: wait for complete response
    return handleSyncResponse(req, res, { requestId, messages, model, provider, image });
}

/**
 * Handle synchronous (blocking) response
 */
async function handleSyncResponse(req, res, { requestId, messages, model, provider, image }) {
    try {
        const result = await provider.chat({ messages, model, image });
        const text = extractOutputText(result);

        logRequest(requestId, 'RESPONSE_COMPLETED', {
            responseId: result.id,
            model: result.model,
            textLength: text?.length
        });

        res.json({
            success: true,
            text,
            content: text, // iOS app compatibility
            id: result.id,
            model: result.model,
            provider: result.provider,
            usage: result.usage,
            raw: result.raw
        });
    } catch (error) {
        logRequest(requestId, 'RESPONSE_ERROR', { error: error.message });
        throw error;
    }
}

/**
 * Handle streaming response via SSE
 */
async function handleStreamingResponse(req, res, { requestId, messages, model, provider, image }) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Request-Id', requestId);
    res.flushHeaders();

    try {
        // Check if provider supports streaming
        if (typeof provider.chatStream === 'function') {
            await provider.chatStream({ messages, model }, (chunk) => {
                res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            });
        } else {
            // Fallback: non-streaming response sent as single chunk
            const result = await provider.chat({ messages, model, image });
            const text = extractOutputText(result);
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }

        // Send completion signal
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();

        logRequest(requestId, 'STREAM_COMPLETED');
    } catch (error) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
        logRequest(requestId, 'STREAM_ERROR', { error: error.message });
    }
}

/**
 * Handle background job execution
 */
async function handleBackgroundJob(req, res, { requestId, messages, model, provider, image }) {
    // Get input summary for job store
    const lastMessage = messages[messages.length - 1];
    const inputSummary = lastMessage?.content || '';

    // Create job entry
    const job = jobStore.createJob(inputSummary, model);

    logRequest(requestId, 'JOB_CREATED', { jobId: job.id });

    // Return job ID immediately
    res.json({
        success: true,
        job_id: job.id,
        status: job.status
    });

    // Process in background (don't await)
    processBackgroundJob(job.id, messages, model, provider, image, requestId);
}

/**
 * Process job asynchronously
 */
async function processBackgroundJob(jobId, messages, model, provider, image, requestId) {
    jobStore.setJobRunning(jobId);

    try {
        const result = await provider.chat({ messages, model, image });
        const text = extractOutputText(result);

        jobStore.setJobCompleted(jobId, text, result.raw);
        logRequest(requestId, 'JOB_COMPLETED', { jobId, textLength: text?.length });
    } catch (error) {
        jobStore.setJobFailed(jobId, error);
        logRequest(requestId, 'JOB_FAILED', { jobId, error: error.message });
    }
}

module.exports = { handleRespond };
