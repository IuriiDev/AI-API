/**
 * DeepSeekProvider - DeepSeek API Implementation
 *
 * Supports:
 * - Chat completions
 * - Streaming responses (SSE)
 */

const axios = require('axios');
const BaseProvider = require('./BaseProvider');

class DeepSeekProvider extends BaseProvider {
    getCapabilities() {
        return ['chat', 'streaming'];
    }

    /**
     * Chat completion
     * @param {import('./BaseProvider').ChatParams} params
     * @returns {Promise<import('./BaseProvider').ChatResponse>}
     */
    async chat({ messages, model, maxCompletionTokens, responseFormat, tools, toolChoice, metadata }) {
        const url = this.buildUrl(this.endpoints.chat);

        const normalizedResponseFormat = typeof responseFormat === 'string'
            ? { type: responseFormat }
            : responseFormat;

        const payload = {
            model: model || this.models.chat,
            messages,
            max_tokens: maxCompletionTokens || this.defaults.maxTokens,
            response_format: normalizedResponseFormat,
            tools,
            tool_choice: toolChoice,
            metadata
        };

        const response = await this.requestWithRetry(url, payload);
        return this.formatChatResponse(response.data);
    }

    /**
     * Streaming chat completion
     * @param {import('./BaseProvider').ChatParams} params
     * @param {Function} onChunk - Callback for each text chunk
     */
    async chatStream({ messages, model, maxCompletionTokens, responseFormat, tools, toolChoice, metadata }, onChunk) {
        const url = this.buildUrl(this.endpoints.chat);

        const normalizedResponseFormat = typeof responseFormat === 'string'
            ? { type: responseFormat }
            : responseFormat;

        const payload = {
            model: model || this.models.chat,
            messages,
            max_tokens: maxCompletionTokens || this.defaults.maxTokens,
            response_format: normalizedResponseFormat,
            tools,
            tool_choice: toolChoice,
            metadata,
            stream: true
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders(),
            responseType: 'stream'
        });

        return new Promise((resolve, reject) => {
            let buffer = '';

            response.data.on('data', chunk => {
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
                        if (content) onChunk(content);
                    } catch {
                        // Skip malformed JSON
                    }
                }
            });

            response.data.on('end', resolve);
            response.data.on('error', reject);
        });
    }

    /**
     * Format chat response to standardized structure
     * @param {Object} data - Raw DeepSeek response
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

module.exports = DeepSeekProvider;
