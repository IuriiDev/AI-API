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
     * Chat completion
     */
    async chat({ messages, model, maxTokens }) {
        const url = this.buildUrl(this.endpoints.chat);
        
        const payload = {
            model: model || this.models.chat,
            messages,
            max_tokens: maxTokens || this.defaults.maxTokens
        };

        const response = await axios.post(url, payload, { 
            headers: this.getHeaders() 
        });

        return this.formatChatResponse(response.data);
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
                                url: `data:image/jpeg;base64,${image}` 
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

