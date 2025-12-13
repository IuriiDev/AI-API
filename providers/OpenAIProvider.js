/**
 * OpenAIProvider - OpenAI API Implementation
 * 
 * Implements: Single Responsibility & Liskov Substitution (SOLID)
 * 
 * Supports:
 * - Chat completions (GPT-5-nano, GPT-4o, etc.)
 * - Image analysis/vision
 * - Image generation (gpt-image-1)
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
     * Chat completion
     */
    async chat({ messages, model, maxCompletionTokens }) {
        const url = this.buildUrl(this.endpoints.chat);

        const payload = {
            model: model || this.models.vision,
            messages,
            max_completion_tokens: maxCompletionTokens || this.defaults.maxCompletionTokens
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Image analysis using vision model
     */
    async analyzeImage({ image, prompt, maxCompletionTokens }) {
        const url = this.buildUrl(this.endpoints.chat);

        const payload = {
            model: this.models.vision,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: this.getBase64ImageUrl(image)
                            }
                        }
                    ]
                }
            ],
            max_completion_tokens: maxCompletionTokens || this.defaults.maxCompletionTokens
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
        });

        return this.formatChatResponse(response.data);
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
     * Format chat/vision response to standardized structure
     */
    formatChatResponse(data) {
        return {
            provider: this.name,
            id: data.id,
            model: data.model,
            content: data.choices?.[0]?.message?.content || null,
            finishReason: data.choices?.[0]?.finish_reason,
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

