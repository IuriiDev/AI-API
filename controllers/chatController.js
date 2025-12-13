/**
 * Chat Controller
 * 
 * Handles chat completion requests
 * Provider-agnostic - works with any registered AI provider
 */

const { getProvider } = require('../providers');

/**
 * POST /api/message
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

    // Pass tokens parameter - providers handle naming internally
    const result = await provider.chat({
        messages,
        model,
        maxCompletionTokens,
        maxTokens: maxCompletionTokens, // For providers using max_tokens (Grok)
        image // Pass image for vision-enabled chat
    });

    res.json({
        success: true,
        ...result
    });
}

module.exports = { handleChat };

