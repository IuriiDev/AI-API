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
 */
async function handleChat(req, res) {
    const { 
        messages, 
        model, 
        maxCompletionTokens,
        provider: providerName = 'openai' 
    } = req.body;

    const provider = getProvider(providerName);
    
    const result = await provider.chat({
        messages,
        model,
        maxCompletionTokens
    });

    res.json({
        success: true,
        ...result
    });
}

module.exports = { handleChat };

