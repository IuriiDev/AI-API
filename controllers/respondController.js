/**
 * Respond Controller
 * 
 * Unified AI response endpoint supporting:
 * - Synchronous responses
 * - Streaming via SSE
 * - Background job execution
 * 
 * Accepts:
 * - input: string (simple user text)
 * - messages: array (conversation history)
 * 
 * @module controllers/respondController
 */

const { getProvider } = require('../providers');
const { APIError, ErrorCodes } = require('../middleware/errorHandler');
const config = require('../config');
const jobStore = require('../utils/jobStore');

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate unique request ID for logging and tracking
 * @returns {string}
 */
function generateRequestId() {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Log request (without user content by default for privacy)
 * @param {string} requestId
 * @param {string} action
 * @param {Object} details
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
 * Extract output text from provider response
 * @param {Object} response - Provider response
 * @returns {string|null}
 */
function extractOutputText(response) {
    return response?.content ||
        response?.choices?.[0]?.message?.content ||
        null;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /ai/respond
 * 
 * @param {Object} req.body
 * @param {string} [req.body.input] - Simple user text
 * @param {Array} [req.body.messages] - Conversation array [{role, content}]
 * @param {string} [req.body.model] - Model override
 * @param {string} [req.body.provider='openai'] - Provider name
 * @param {string} [req.body.image] - Base64 encoded image
 * @param {boolean} [req.body.stream=false] - Enable SSE streaming
 * @param {boolean} [req.body.background=false] - Run as background job
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
        image,
        response_format: responseFormat,
        tools,
        tool_choice: toolChoice,
        metadata
    } = req.body;

    // Parse input: accept either 'input' string or 'messages' array
    const messages = parseInput(input, inputMessages);

    logRequest(requestId, 'REQUEST_RECEIVED', {
        model,
        stream,
        background,
        provider: providerName,
        messageCount: messages.length,
        hasImage: !!image
    });

    const provider = getProvider(providerName);

    // Route to appropriate handler
    if (background) {
        return handleBackgroundJob(req, res, { requestId, messages, model, provider, image, responseFormat, tools, toolChoice, metadata });
    }

    if (stream) {
        return handleStreamingResponse(req, res, { requestId, messages, model, provider, image, responseFormat, tools, toolChoice, metadata });
    }

    return handleSyncResponse(req, res, { requestId, messages, model, provider, image, responseFormat, tools, toolChoice, metadata });
}

/**
 * Parse and validate input from request body
 * @param {string} input - Simple input string
 * @param {Array} messages - Messages array
 * @returns {Array} Validated messages array
 * @throws {APIError} If input is invalid
 */
function parseInput(input, messages) {
    // Option 1: Messages array (iOS/Web app format)
    if (messages && Array.isArray(messages) && messages.length > 0) {
        return messages;
    }

    // Option 2: Simple input string
    if (input && typeof input === 'string') {
        const trimmed = input.trim();

        if (trimmed.length < config.validation.minInputLength) {
            throw new APIError(
                'Input cannot be empty',
                400,
                ErrorCodes.INPUT_REQUIRED
            );
        }

        if (trimmed.length > config.validation.maxInputLength) {
            throw new APIError(
                `Input exceeds maximum length of ${config.validation.maxInputLength} characters`,
                400,
                ErrorCodes.INPUT_TOO_LONG
            );
        }

        return [{ role: 'user', content: trimmed }];
    }

    throw new APIError(
        'Either input string or messages array is required',
        400,
        ErrorCodes.INPUT_REQUIRED
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Handle synchronous (blocking) response
 */
async function handleSyncResponse(req, res, { requestId, messages, model, provider, image, responseFormat, tools, toolChoice, metadata }) {
    const result = await provider.chat({ messages, model, image, responseFormat, tools, toolChoice, metadata });
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
}

/**
 * Handle streaming response via SSE
 */
async function handleStreamingResponse(req, res, { requestId, messages, model, provider, image, responseFormat, tools, toolChoice, metadata }) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Request-Id', requestId);
    res.flushHeaders();

    try {
        if (typeof provider.chatStream === 'function') {
            await provider.chatStream({ messages, model, image, responseFormat, tools, toolChoice, metadata }, (chunk) => {
                res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            });
        } else {
            // Fallback: non-streaming response as single chunk
            const result = await provider.chat({ messages, model, image, responseFormat, tools, toolChoice, metadata });
            res.write(`data: ${JSON.stringify({ text: extractOutputText(result) })}\n\n`);
        }

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
async function handleBackgroundJob(req, res, { requestId, messages, model, provider, image, responseFormat, tools, toolChoice, metadata }) {
    const lastMessage = messages[messages.length - 1];
    const job = jobStore.createJob(lastMessage?.content || '', model);

    logRequest(requestId, 'JOB_CREATED', { jobId: job.id });

    res.json({
        success: true,
        job_id: job.id,
        status: job.status
    });

    // Process in background (fire and forget)
    processBackgroundJob(job.id, messages, model, provider, image, requestId, responseFormat, tools, toolChoice, metadata);
}

/**
 * Process job asynchronously
 */
async function processBackgroundJob(jobId, messages, model, provider, image, requestId, responseFormat, tools, toolChoice, metadata) {
    jobStore.setJobRunning(jobId);

    try {
        const result = await provider.chat({ messages, model, image, responseFormat, tools, toolChoice, metadata });
        const text = extractOutputText(result);

        jobStore.setJobCompleted(jobId, text, result.raw);
        logRequest(requestId, 'JOB_COMPLETED', { jobId, textLength: text?.length });
    } catch (error) {
        jobStore.setJobFailed(jobId, error);
        logRequest(requestId, 'JOB_FAILED', { jobId, error: error.message });
    }
}

module.exports = { handleRespond };
