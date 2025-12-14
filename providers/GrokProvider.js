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
        return ['chat', 'vision', 'streaming'];
    }

    /**
     * Chat completion (with optional vision support)
     * @param {import('./BaseProvider').ChatParams} params
     * @returns {Promise<import('./BaseProvider').ChatResponse>}
     */
    async chat({ messages, model, maxTokens, image, responseFormat, tools, toolChoice, metadata }) {
        const url = this.buildUrl(this.endpoints.chat);

        // Use inherited formatMessagesWithImage from BaseProvider
        const formattedMessages = image
            ? this.formatMessagesWithImage(messages, image)
            : messages;

        const normalizedResponseFormat = typeof responseFormat === 'string'
            ? { type: responseFormat }
            : responseFormat;

        const payload = {
            model: image ? this.models.vision : (model || this.models.chat),
            messages: formattedMessages,
            max_tokens: maxTokens || this.defaults.maxTokens,
            response_format: normalizedResponseFormat,
            tools,
            tool_choice: toolChoice,
            metadata
        };

        // Use inherited requestWithRetry (includes retry logic)
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
     * Streaming chat completion (OpenAI-compatible)
     * @param {import('./BaseProvider').ChatParams} params
     * @param {Function} onChunk
     */
    async chatStream({ messages, model, maxTokens, image, responseFormat, tools, toolChoice, metadata }, onChunk) {
        const url = this.buildUrl(this.endpoints.chat);

        const formattedMessages = image
            ? this.formatMessagesWithImage(messages, image)
            : messages;

        const normalizedResponseFormat = typeof responseFormat === 'string'
            ? { type: responseFormat }
            : responseFormat;

        const payload = {
            model: image ? this.models.vision : (model || this.models.chat),
            messages: formattedMessages,
            max_tokens: maxTokens || this.defaults.maxTokens,
            response_format: normalizedResponseFormat,
            tools,
            tool_choice: toolChoice,
            metadata,
            stream: true
        };

        const response = await this.requestWithRetry(url, payload, { responseType: 'stream' });

        return new Promise((resolve, reject) => {
            let buffer = '';

            response.data.on('data', (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        const content = Array.isArray(delta?.content)
                            ? delta.content.map(part => part?.text || part?.content || '').join('')
                            : delta?.content;
                        if (content) {
                            onChunk(content);
                        }
                    } catch {
                        // Ignore malformed chunks
                    }
                }
            });

            response.data.on('end', resolve);
            response.data.on('error', reject);
        });
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
            toolCalls: data.choices?.[0]?.message?.tool_calls || [],
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
