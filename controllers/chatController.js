/**
 * Chat Controller
 * 
 * Handles chat completion requests (standard and streaming)
 * Provider-agnostic - works with any registered AI provider
 */

const { getProvider } = require('../providers');

/**
 * POST /api/message
 * 
 * Standard (non-streaming) chat completion
 * 
 * Body:
 * - messages: Array of message objects [{ role, content }]
 * - model: (optional) Model to use
 * - maxCompletionTokens: (optional) Max tokens in response
 * - provider: (optional) AI provider to use (default: openai)
 * - image: (optional) Base64 encoded image for vision chat
 */
async function handleChat(req, res) {
    const {
        messages,
        model,
        maxCompletionTokens,
        provider: providerName = 'openai',
        image
    } = req.body;

    const provider = getProvider(providerName);

    const result = await provider.chat({
        messages,
        model,
        maxCompletionTokens,
        maxTokens: maxCompletionTokens,
        image
    });

    res.json({
        success: true,
        ...result
    });
}

/**
 * POST /api/message/stream
 * 
 * Streaming chat completion using Server-Sent Events (SSE)
 * Eliminates timeout issues and provides real-time text display
 * 
 * Body: Same as /api/message
 * Response: SSE stream with chunks:
 *   - data: { text: "chunk" }
 *   - data: { done: true, content: "full text" }
 *   - data: { error: "message" } (on error)
 */
async function handleStreamChat(req, res) {
    const {
        messages,
        model,
        maxCompletionTokens,
        provider: providerName = 'openai',
        image
    } = req.body;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Prevent client timeout
    res.flushHeaders();

    const provider = getProvider(providerName);

    try {
        await provider.chatStream({
            messages,
            model,
            maxCompletionTokens,
            maxTokens: maxCompletionTokens,
            image,
            onChunk: (text) => {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            },
            onComplete: (fullContent, usage) => {
                res.write(`data: ${JSON.stringify({
                    done: true,
                    content: fullContent,
                    usage
                })}\n\n`);
                res.end();
            },
            onError: (error) => {
                res.write(`data: ${JSON.stringify({
                    error: error.message || 'Stream error occurred'
                })}\n\n`);
                res.end();
            }
        });
    } catch (error) {
        // Handle errors that occur before streaming starts
        res.write(`data: ${JSON.stringify({
            error: error.message || 'Failed to start stream'
        })}\n\n`);
        res.end();
    }
}

module.exports = { handleChat, handleStreamChat };
