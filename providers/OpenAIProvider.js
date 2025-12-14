/**
 * OpenAIProvider - OpenAI API Implementation
 * 
 * Implements: Single Responsibility & Liskov Substitution (SOLID)
 * 
 * Supports:
 * - Chat completions (GPT-5.2, GPT-5-mini, GPT-5-nano)
 * - Streaming responses (SSE)
 * - Image analysis/vision
 * - Image generation (gpt-image-1)
 * - Retry logic with exponential backoff (inherited from BaseProvider)
 */

const axios = require('axios');
const BaseProvider = require('./BaseProvider');

class OpenAIProvider extends BaseProvider {

    getCapabilities() {
        return ['chat', 'vision', 'imageGeneration', 'streaming'];
    }

    /**
     * Chat completion (with optional vision support)
     * @param {import('./BaseProvider').ChatParams} params
     * @returns {Promise<import('./BaseProvider').ChatResponse>}
     */
    async chat({ messages, model, maxCompletionTokens, image }) {
        const url = this.buildUrl(this.endpoints.chat);

        // If image provided, transform messages for vision
        const formattedMessages = image
            ? this.formatMessagesWithImage(messages, image)
            : messages;

        const payload = {
            model: image ? this.models.vision : (model || this.models.chat),
            messages: formattedMessages,
            max_completion_tokens: maxCompletionTokens || this.defaults.maxCompletionTokens
        };

        const response = await this.requestWithRetry(url, payload);
        return this.formatChatResponse(response.data);
    }

    /**
     * Streaming chat completion with vision support
     * @param {import('./BaseProvider').ChatParams} params
     * @param {Function} onChunk - Callback for each text chunk
     */
    async chatStream({ messages, model, maxCompletionTokens, image }, onChunk) {
        const url = this.buildUrl(this.endpoints.chat);

        // If image provided, transform messages for vision
        const formattedMessages = image
            ? this.formatMessagesWithImage(messages, image)
            : messages;

        const payload = {
            model: image ? this.models.vision : (model || this.models.chat),
            messages: formattedMessages,
            max_completion_tokens: maxCompletionTokens || this.defaults.maxCompletionTokens,
            stream: true
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders(),
            responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
            let buffer = '';

            response.data.on('data', (chunk) => {
                buffer += chunk.toString();

                // Process complete SSE messages
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) onChunk(content);
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }
            });

            response.data.on('end', resolve);
            response.data.on('error', reject);
        });
    }

    /**
     * Image analysis using vision model
     * @param {Object} params - { image, prompt, maxCompletionTokens }
     * @returns {Promise<import('./BaseProvider').ChatResponse>}
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
                            image_url: { url: this.getBase64ImageUrl(image) }
                        }
                    ]
                }
            ],
            max_completion_tokens: maxCompletionTokens || this.defaults.maxCompletionTokens
        };

        const response = await this.requestWithRetry(url, payload);
        return this.formatChatResponse(response.data);
    }

    /**
     * Image generation using gpt-image-1
     * @param {Object} params - { prompt, size, quality, count }
     * @returns {Promise<Object>}
     */
    async generateImage({ prompt, size, quality, count }) {
        const url = this.buildUrl(this.endpoints.imageGeneration);

        const payload = {
            model: this.models.imageGeneration,
            prompt: prompt.trim(),
            n: count || 1,
            size: size || '1024x1024',
            quality: quality || 'standard',
            response_format: 'b64_json'
        };

        const response = await this.requestWithRetry(url, payload);
        return this.formatImageResponse(response.data);
    }

    /**
     * Format chat response to standardized structure
     * @param {Object} data - Raw OpenAI response
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

    /**
     * Format image generation response
     * @param {Object} data - Raw OpenAI response
     * @returns {Object}
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
