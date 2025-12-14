/**
 * GrokProvider - xAI Grok API Implementation
 * 
 * API: OpenAI-compatible (https://api.x.ai/v1)
 * 
 * Models:
 * - grok-4-1-fast-non-reasoning (2M context, fast responses)
 * 
 * Uses OpenAI-compatible format, inherits shared functionality from BaseProvider
 */

const BaseProvider = require('./BaseProvider');

class GrokProvider extends BaseProvider {

    getCapabilities() {
        return ['chat', 'vision'];
    }

    /**
     * Chat completion (with optional vision support)
     * @param {import('./BaseProvider').ChatParams} params
     * @returns {Promise<import('./BaseProvider').ChatResponse>}
     */
    async chat({ messages, model, maxTokens, image }) {
        const url = this.buildUrl(this.endpoints.chat);

        // Use inherited formatMessagesWithImage from BaseProvider
        const formattedMessages = image
            ? this.formatMessagesWithImage(messages, image)
            : messages;

        const payload = {
            model: image ? this.models.vision : (model || this.models.chat),
            messages: formattedMessages,
            max_tokens: maxTokens || this.defaults.maxTokens
        };

        // Use inherited requestWithRetry (includes timeout and retry logic)
        const response = await this.requestWithRetry(url, payload);
        return this.formatChatResponse(response.data);
    }

    /**
     * Image analysis using vision model
     * @param {Object} params - { image, prompt, maxTokens }
     * @returns {Promise<import('./BaseProvider').ChatResponse>}
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
                            image_url: { url: this.getBase64ImageUrl(image) }
                        }
                    ]
                }
            ],
            max_tokens: maxTokens || this.defaults.maxTokens
        };

        const response = await this.requestWithRetry(url, payload);
        return this.formatChatResponse(response.data);
    }

    /**
     * Format Grok response to standardized structure
     * @param {Object} data - Raw Grok response
     * @returns {import('./BaseProvider').ChatResponse}
     */
    formatChatResponse(data) {
        return {
            provider: this.name,
            id: data.id,
            model: data.model,
            content: data.choices?.[0]?.message?.content || null,
            finishReason: data.choices?.[0]?.finish_reason,
            usage: {
                promptTokens: data.usage?.prompt_tokens,
                completionTokens: data.usage?.completion_tokens,
                totalTokens: data.usage?.total_tokens
            },
            raw: data
        };
    }
}

module.exports = GrokProvider;
