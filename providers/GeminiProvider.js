/**
 * GeminiProvider - Google Gemini API Implementation
 * 
 * API: https://generativelanguage.googleapis.com/v1beta
 * Auth: API key in URL parameter (not header)
 * 
 * Models:
 * - gemini-3-pro (most advanced, multimodal)
 * - gemini-2.5-flash (1M context, balanced)
 * 
 * Note: Uses different format from OpenAI:
 * - 'contents' instead of 'messages'
 * - 'parts' with 'text' and 'inline_data'
 * - 'role: model' instead of 'role: assistant'
 */

const BaseProvider = require('./BaseProvider');
const config = require('../config');

class GeminiProvider extends BaseProvider {
    constructor(providerConfig) {
        super(providerConfig);
    }

    getCapabilities() {
        return ['chat', 'vision'];
    }

    /**
     * Get headers - Gemini uses API key in URL, not header
     */
    getHeaders() {
        return {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Build URL with API key
     */
    buildGeminiUrl(model) {
        return `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
    }

    /**
     * Build streaming URL with API key
     */
    buildStreamUrl(model) {
        return `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    }

    /**
     * Chat completion (with optional vision support)
     */
    async chat({ messages, model, maxCompletionTokens, image }) {
        const modelName = image ? this.models.vision : (model || this.models.chat);
        const url = this.buildGeminiUrl(modelName);

        // Convert messages to Gemini format (with optional image)
        const contents = this.convertToGeminiFormat(messages, image);

        const payload = {
            contents,
            generationConfig: {
                maxOutputTokens: maxCompletionTokens || this.defaults.maxOutputTokens
            }
        };

        const response = await this.request(url, payload, {
            timeout: config.http.timeouts.chat
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Streaming chat completion using SSE
     * Gemini returns: data: {"candidates":[{"content":{"parts":[{"text":"chunk"}]}}]}
     */
    async chatStream({ messages, model, maxCompletionTokens, image, onChunk, onComplete, onError }) {
        const modelName = image ? this.models.vision : (model || this.models.chat);
        const url = this.buildStreamUrl(modelName);

        const contents = this.convertToGeminiFormat(messages, image);

        const payload = {
            contents,
            generationConfig: {
                maxOutputTokens: maxCompletionTokens || this.defaults.maxOutputTokens
            }
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

                        try {
                            const parsed = JSON.parse(data);
                            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;

                            if (text) {
                                fullContent += text;
                                onChunk(text);
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
     * Image analysis using vision model
     */
    async analyzeImage({ image, prompt, maxCompletionTokens }) {
        const modelName = this.models.vision;
        const url = this.buildGeminiUrl(modelName);

        const payload = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: image
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                maxOutputTokens: maxCompletionTokens || this.defaults.maxOutputTokens
            }
        };

        const response = await this.request(url, payload, {
            timeout: config.http.timeouts.chat
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Convert OpenAI message format to Gemini format
     * Optionally adds image as inline_data to last user message
     */
    convertToGeminiFormat(messages, image) {
        const contents = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        // Add image to last user message if provided
        if (image) {
            for (let i = contents.length - 1; i >= 0; i--) {
                if (contents[i].role === 'user') {
                    contents[i].parts.push({
                        inline_data: {
                            mime_type: 'image/jpeg',
                            data: image
                        }
                    });
                    break;
                }
            }
        }

        return contents;
    }

    /**
     * Format response to standardized structure
     */
    formatChatResponse(data) {
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || null;

        return {
            provider: this.name,
            id: null,
            model: data.modelVersion || null,
            content,
            finishReason: data.candidates?.[0]?.finishReason,
            usage: {
                promptTokens: data.usageMetadata?.promptTokenCount,
                completionTokens: data.usageMetadata?.candidatesTokenCount,
                totalTokens: data.usageMetadata?.totalTokenCount
            },
            raw: data
        };
    }
}

module.exports = GeminiProvider;
