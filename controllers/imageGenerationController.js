/**
 * Image Generation Controller
 * 
 * Handles image generation requests
 * Provider-agnostic - works with any registered AI provider that supports image generation
 */

const { getProvider, providerSupports } = require('../providers');
const { APIError } = require('../middleware/errorHandler');
const config = require('../config');

/**
 * POST /api/generate-image
 * 
 * Body:
 * - prompt: Image description
 * - size: (optional) Image size (1024x1024, 1536x1024, 1024x1536)
 * - quality: (optional) Image quality (auto, low, medium, high)
 * - outputFormat: (optional) Output format (png, jpeg, webp)
 * - count: (optional) Number of images to generate
 * - provider: (optional) AI provider to use (default: openai)
 */
async function handleImageGeneration(req, res) {
    const { 
        prompt, 
        size,
        quality,
        outputFormat,
        count,
        provider: providerName = 'openai' 
    } = req.body;

    // Verify provider supports image generation
    if (!providerSupports(providerName, 'imageGeneration')) {
        throw new APIError(
            `Provider ${providerName} does not support image generation`,
            400
        );
    }

    const provider = getProvider(providerName);
    const defaults = config.imageSettings.defaults;
    
    const result = await provider.generateImage({
        prompt,
        size: size || defaults.size,
        quality: quality || defaults.quality,
        outputFormat: outputFormat || defaults.format,
        count: count || defaults.count
    });

    res.json({
        success: true,
        message: 'Image generated successfully',
        ...result
    });
}

module.exports = { handleImageGeneration };

