/**
 * OpenAIProvider - OpenAI API Implementation
 * 
 * Implements: Single Responsibility & Liskov Substitution (SOLID)
 * 
 * Supports:
 * - Responses API (GPT-5.2, GPT-5-mini, GPT-5-nano)
 * - Image analysis/vision
 * - Image generation (gpt-image-1)
 * 
 * Note: Uses the new Responses API (March 2025) instead of Chat Completions API
 */

const axios = require('axios');
const BaseProvider = require('./BaseProvider');

class OpenAIProvider extends BaseProvider {
    constructor(config) {
        super(config);
    }

    getCapabilities() {
        return ['chat', 'vision', 'imageGeneration'];
    }

    /**
     * Chat using Responses API (GPT-5 models)
     * Converts messages array to input string for the new API format
     */
    async chat({ messages, model, maxCompletionTokens, image }) {
        const url = this.buildUrl(this.endpoints.responses);

        // Convert messages array to input format for Responses API
        let input;
        if (image) {
            // For vision: use multimodal input format
            input = this.formatInputWithImage(messages, image);
        } else {
            // For text only: use messages format (Responses API supports both)
            input = messages;
        }

        const payload = {
            model: image ? this.models.vision : (model || this.models.chat),
            input: input
        };

        // Add max_output_tokens if specified (optional for Responses API)
        if (maxCompletionTokens || this.defaults.maxCompletionTokens) {
            payload.max_output_tokens = maxCompletionTokens || this.defaults.maxCompletionTokens;
        }

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
        });

        return this.formatResponsesAPIResponse(response.data);
    }

    /**
     * Format input with image for vision (Responses API format)
     */
    formatInputWithImage(messages, image) {
        // Get the last user message text
        let userText = '';
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                userText = messages[i].content;
                break;
            }
        }

        // Return multimodal input array for Responses API
        return [
            { type: 'input_text', text: userText },
            {
                type: 'input_image',
                image_url: this.getBase64ImageUrl(image)
            }
        ];
    }

    /**
     * Image analysis using vision model (Responses API)
     */
    async analyzeImage({ image, prompt, maxCompletionTokens }) {
        const url = this.buildUrl(this.endpoints.responses);

        const payload = {
            model: this.models.vision,
            input: [
                { type: 'input_text', text: prompt },
                {
                    type: 'input_image',
                    image_url: this.getBase64ImageUrl(image)
                }
            ]
        };

        if (maxCompletionTokens || this.defaults.maxCompletionTokens) {
            payload.max_output_tokens = maxCompletionTokens || this.defaults.maxCompletionTokens;
        }

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
        });

        return this.formatResponsesAPIResponse(response.data);
    }

    /**
     * Image generation using gpt-image-1
     */
    async generateImage({ prompt, size, quality, outputFormat, count }) {
        const url = this.buildUrl(this.endpoints.imageGeneration);

        const payload = {
            model: this.models.imageGeneration,
            prompt: prompt.trim(),
            n: count || 1,
            size: size || '1024x1024',
            quality: quality || 'auto',
            output_format: outputFormat || 'png'
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
        });

        return this.formatImageResponse(response.data);
    }

    /**
     * Format Responses API response to standardized structure
     */
    formatResponsesAPIResponse(data) {
        return {
            provider: this.name,
            id: data.id,
            model: data.model,
            content: data.output_text || null,
            finishReason: data.status,
            usage: data.usage,
            raw: data
        };
    }

    /**
     * Format image generation response to standardized structure
     */
    formatImageResponse(data) {
        const images = data.data?.map(item => item.b64_json) || [];

        return {
            provider: this.name,
            images,
            imageBase64: images[0] || null,
            count: images.length,
            raw: data
        };
    }
}

module.exports = OpenAIProvider;
