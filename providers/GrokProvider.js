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

const BaseProvider = require('./BaseProvider');
const config = require('../config');

class GrokProvider extends BaseProvider {
    constructor(providerConfig) {
        super(providerConfig);
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

        const response = await this.request(url, payload, {
            timeout: config.http.timeouts.chat
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Streaming chat completion using SSE
     * Grok uses OpenAI-compatible format: data: {"choices":[{"delta":{"content":"text"}}]}
     */
    async chatStream({ messages, model, maxTokens, image, onChunk, onComplete, onError }) {
        const url = this.buildUrl(this.endpoints.chat);

        let formattedMessages = messages;
        if (image) {
            formattedMessages = this.formatMessagesWithImage(messages, image);
        }

        const payload = {
            model: image ? this.models.vision : (model || this.models.chat),
            messages: formattedMessages,
            max_tokens: maxTokens || this.defaults.maxTokens,
            stream: true
        };

        try {
            const response = await this.httpClient.post(url, payload, {
                headers: this.getHeaders(),
                responseType: 'stream'
            });

            let fullContent = '';
            let buffer = '';

            response.data.on('data', (chunk) => {
                buffer += chunk.toString();

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            continue;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;

                            if (content) {
                                fullContent += content;
                                onChunk(content);
                            }
                        } catch (e) {
                            // Skip malformed chunks
                        }
                    }
                }
            });

            response.data.on('end', () => {
                onComplete(fullContent);
            });

            response.data.on('error', (error) => {
                onError(error);
            });
        } catch (error) {
            onError(error);
        }
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

        const response = await this.request(url, payload, {
            timeout: config.http.timeouts.chat
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
