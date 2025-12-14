/**
 * Respond Controller
 * 
 * Unified AI response endpoint supporting:
 * - Synchronous responses
 * - Streaming via SSE
 * - Background job execution
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
 * Body:
 * - input: string (user text)
 * - model: string (optional)
 * - stream: boolean (optional, default: false)
 * - background: boolean (optional, default: false)
 */
async function handleRespond(req, res) {
    const requestId = generateRequestId();
    const {
        input,
        model,
        stream = false,
        background = false,
        provider: providerName = 'openai'
    } = req.body;

    logRequest(requestId, 'REQUEST_RECEIVED', {
        model,
        stream,
        background,
        provider: providerName,
        inputLength: input?.length
    });

    // Validate input
    if (!input || typeof input !== 'string') {
        throw new APIError('Invalid request: input string is required', 400);
    }

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

    const provider = getProvider(providerName);

    // Background mode: create job and return immediately
    if (background) {
        return handleBackgroundJob(req, res, { requestId, input: trimmedInput, model, provider });
    }

    // Streaming mode: SSE response
    if (stream) {
        return handleStreamingResponse(req, res, { requestId, input: trimmedInput, model, provider });
    }

    // Synchronous mode: wait for complete response
    return handleSyncResponse(req, res, { requestId, input: trimmedInput, model, provider });
}

/**
 * Handle synchronous (blocking) response
 */
async function handleSyncResponse(req, res, { requestId, input, model, provider }) {
    const messages = [{ role: 'user', content: input }];

    try {
        const result = await provider.chat({ messages, model });
        const text = extractOutputText(result);

        logRequest(requestId, 'RESPONSE_COMPLETED', {
            responseId: result.id,
            model: result.model,
            textLength: text?.length
        });

        res.json({
            success: true,
            text,
            id: result.id,
            model: result.model,
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
async function handleStreamingResponse(req, res, { requestId, input, model, provider }) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Request-Id', requestId);
    res.flushHeaders();

    const messages = [{ role: 'user', content: input }];

    try {
        // Check if provider supports streaming
        if (typeof provider.chatStream === 'function') {
            await provider.chatStream({ messages, model }, (chunk) => {
                res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            });
        } else {
            // Fallback: non-streaming response sent as single chunk
            const result = await provider.chat({ messages, model });
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
async function handleBackgroundJob(req, res, { requestId, input, model, provider }) {
    // Create job entry
    const job = jobStore.createJob(input, model);

    logRequest(requestId, 'JOB_CREATED', { jobId: job.id });

    // Return job ID immediately
    res.json({
        success: true,
        job_id: job.id,
        status: job.status
    });

    // Process in background (don't await)
    processBackgroundJob(job.id, input, model, provider, requestId);
}

/**
 * Process job asynchronously
 */
async function processBackgroundJob(jobId, input, model, provider, requestId) {
    jobStore.setJobRunning(jobId);

    try {
        const messages = [{ role: 'user', content: input }];
        const result = await provider.chat({ messages, model });
        const text = extractOutputText(result);

        jobStore.setJobCompleted(jobId, text, result.raw);
        logRequest(requestId, 'JOB_COMPLETED', { jobId, textLength: text?.length });
    } catch (error) {
        jobStore.setJobFailed(jobId, error);
        logRequest(requestId, 'JOB_FAILED', { jobId, error: error.message });
    }
}

module.exports = { handleRespond };
