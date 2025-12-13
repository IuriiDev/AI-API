/**
 * GrokProvider - xAI Grok API Implementation
 * 
 * API: OpenAI-compatible (https://api.x.ai/v1)
 * 
 * Models:
 * - grok-4 (256K context, advanced reasoning)
 * - grok-4.1-fast (2M context, fast responses)
 * - grok-2-vision (image analysis)
 * 
 * Pricing: $3/1M input, $15/1M output tokens
 */

const axios = require('axios');
const BaseProvider = require('./BaseProvider');

class GrokProvider extends BaseProvider {
    constructor(config) {
        super(config);
    }

    getCapabilities() {
        return ['chat', 'vision'];
    }

    /**
     * Chat completion (with optional vision support)
     */
    async chat({ messages, model, maxTokens, image }) {
        const url = this.buildUrl(this.endpoints.chat);

        // If image provided, transform last user message for vision
        let formattedMessages = messages;
        if (image) {
            formattedMessages = this.formatMessagesWithImage(messages, image);
        }

        const payload = {
            model: image ? this.models.vision : (model || this.models.chat),
            messages: formattedMessages,
            max_tokens: maxTokens || this.defaults.maxTokens
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Format messages with image for vision
     */
    formatMessagesWithImage(messages, image) {
        const formatted = [...messages];

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
    async analyzeImage({ image, prompt, maxTokens }) {
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
            max_tokens: maxTokens || this.defaults.maxTokens
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Format response to standardized structure
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
}

module.exports = GrokProvider;

