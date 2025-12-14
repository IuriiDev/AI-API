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
     * Chat completion (with optional vision support)
     */
    async chat({ messages, model, maxCompletionTokens, maxTokens, image }) {
        const url = this.buildUrl(this.endpoints.chat);

        // If image provided, transform last user message for vision
        let formattedMessages = messages;
        if (image) {
            formattedMessages = this.formatMessagesWithImage(messages, image);
        }

        const payload = {
            model: image ? this.models.vision : (model || this.models.vision),
            messages: formattedMessages,
            max_tokens: maxTokens || maxCompletionTokens || this.defaults.maxTokens
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Format messages with image for vision
     * Converts last user message to multimodal content array
     */
    formatMessagesWithImage(messages, image) {
        const formatted = [...messages];

        // Find last user message
        for (let i = formatted.length - 1; i >= 0; i--) {
            if (formatted[i].role === 'user') {
                formatted[i] = {
                    role: 'user',
                    content: [
                        { type: 'text', text: formatted[i].content },
                        {
                            type: 'image_url',
                            image_url: {
                                url: this.getBase64ImageUrl(image)
                            }
                        }
                    ]
                };
                break;
            }
        }

        return formatted;
    }

    /**
     * Image analysis using vision model
     */
    async analyzeImage({ image, prompt, maxCompletionTokens, maxTokens }) {
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
            max_tokens: maxTokens || maxCompletionTokens || this.defaults.maxTokens
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

