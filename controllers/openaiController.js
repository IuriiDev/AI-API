const axios = require('axios');
const {
    ENDPOINTS,
    MODELS,
    TOKEN_LIMITS,
    IMAGE_SETTINGS,
    headers
} = require('../utils/constants');

/**
 * Handle Chat Completions
 * Supports any OpenAI chat model
 */
exports.handleChatMessage = async (req, res) => {
    const { messages, model, max_completion_tokens } = req.body;

    if (!Array.isArray(messages) || !model) {
        return res.status(400).json({
            error: 'Invalid request: missing model or messages.'
        });
    }

    const payload = {
        model,
        messages,
        max_completion_tokens: max_completion_tokens || TOKEN_LIMITS.DEFAULT_MAX_OUTPUT
    };

    try {
        const response = await axios.post(ENDPOINTS.CHAT_COMPLETIONS, payload, { headers });
        res.json(response.data);
    } catch (error) {
        logAndRespond(res, 'Chat Completion Error', error);
    }
};

/**
 * Handle Vision + Image Analysis
 * Uses GPT-5-nano for cost-effective, fast image analysis
 * 
 * GPT-5-nano specs:
 * - 400K token context window
 * - Up to 128K output tokens
 * - Optimized for summarization and classification
 */
exports.handleImageAnalysis = async (req, res) => {
    const { image, prompt, max_completion_tokens } = req.body;

    if (!image || !prompt) {
        return res.status(400).json({
            error: 'Missing image or prompt.'
        });
    }

    const payload = {
        model: MODELS.GPT_5_NANO,
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: prompt
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:image/jpeg;base64,${image}`
                        }
                    }
                ]
            }
        ],
        max_completion_tokens: max_completion_tokens || TOKEN_LIMITS.DEFAULT_MAX_OUTPUT
    };

    try {
        const response = await axios.post(ENDPOINTS.CHAT_COMPLETIONS, payload, { headers });
        res.json(response.data);
    } catch (error) {
        logAndRespond(res, 'Image Analysis Error', error);
    }
};

/**
 * Handle Image Generation
 * Uses gpt-image-1 - OpenAI's latest image generation model (April 2025)
 * 
 * Features:
 * - High-quality, professional-grade image generation
 * - Multimodal: accepts text and image inputs
 * - Accurate text rendering in images
 * - Diverse styles and custom guidelines support
 * 
 * Pricing (per token):
 * - Text input: $5/1M tokens
 * - Image output: $40/1M tokens
 * - ~$0.02 for low quality 1024x1024
 * - ~$0.19 for high quality 1024x1024
 */
exports.handleImageGeneration = async (req, res) => {
    const { 
        prompt, 
        size = IMAGE_SETTINGS.DEFAULTS.SIZE,
        quality = IMAGE_SETTINGS.DEFAULTS.QUALITY,
        output_format = IMAGE_SETTINGS.DEFAULTS.FORMAT,
        n = IMAGE_SETTINGS.DEFAULTS.COUNT
    } = req.body;

    if (typeof prompt !== 'string' || !prompt.trim()) {
        return res.status(400).json({
            error: 'Invalid or missing prompt.'
        });
    }

    const payload = {
        model: MODELS.GPT_IMAGE_1,
        prompt: prompt.trim(),
        n,
        size,
        quality,
        output_format
    };

    try {
        const response = await axios.post(ENDPOINTS.IMAGE_GENERATIONS, payload, { headers });
        const data = response.data.data;

        if (!data || data.length === 0) {
            return res.status(500).json({
                error: 'No image data found in response.'
            });
        }

        // Return the base64 image(s)
        const images = data.map(item => item.b64_json);

        res.json({
            message: 'Image generated successfully.',
            images: images,
            imageBase64: images[0] // For backward compatibility
        });
    } catch (error) {
        logAndRespond(res, 'Image Generation Error', error);
    }
};

/**
 * Utility: Log error and send clean response
 */
function logAndRespond(res, label, error) {
    const errorDetails = error.response?.data || error.message;
    console.error(`${label}:`, errorDetails);
    
    res.status(error.response?.status || 500).json({
        error: label,
        details: errorDetails
    });
}
