/**
 * Image Analysis Controller
 * 
 * Handles image analysis (vision) requests
 * Provider-agnostic - works with any registered AI provider that supports vision
 */

const { getProvider, providerSupports } = require('../providers');
const { APIError } = require('../middleware/errorHandler');

/**
 * POST /api/analyze-image
 * 
 * Body:
 * - image: Base64 encoded image data
 * - prompt: Analysis prompt/question
 * - maxCompletionTokens: (optional) Max tokens in response
 * - provider: (optional) AI provider to use (default: openai)
 */
async function handleImageAnalysis(req, res) {
    const { 
        image, 
        prompt, 
        maxCompletionTokens,
        provider: providerName = 'openai' 
    } = req.body;

    // Verify provider supports vision
    if (!providerSupports(providerName, 'vision')) {
        throw new APIError(
            `Provider ${providerName} does not support image analysis`,
            400
        );
    }

    const provider = getProvider(providerName);
    
    const result = await provider.analyzeImage({
        image,
        prompt,
        maxCompletionTokens
    });

    res.json({
        success: true,
        ...result
    });
}

module.exports = { handleImageAnalysis };

