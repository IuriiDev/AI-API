/**
 * GeminiProvider - Google Gemini API Implementation
 * 
 * API: https://generativelanguage.googleapis.com/v1beta
 * Auth: API key in URL parameter (not header)
 * 
 * Models:
 * - gemini-2.5-flash (multimodal, 1M context)
 * 
 * Note: Uses different format from OpenAI:
 * - 'contents' instead of 'messages'
 * - 'parts' with 'text' and 'inline_data'
 * - 'role: model' instead of 'role: assistant'
 */

const axios = require('axios');
const BaseProvider = require('./BaseProvider');

class GeminiProvider extends BaseProvider {

    getCapabilities() {
        return ['chat', 'vision'];
    }

    /**
     * Get headers - Gemini uses API key in URL, not header
     * @returns {Object} HTTP headers
     */
    getHeaders() {
        return {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Build Gemini URL with model and API key
     * @param {string} model - Model name
     * @returns {string} Full URL
     */
    buildGeminiUrl(model) {
        return `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
    }

    /**
     * Chat completion (with optional vision support)
     * @param {import('./BaseProvider').ChatParams} params
     * @returns {Promise<import('./BaseProvider').ChatResponse>}
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

        // Use shared retry logic with custom options (no auth header, key in URL)
        const response = await axios.post(url, payload, {
            headers: this.getHeaders(),
            timeout: this.timeouts.requestMs
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Image analysis using vision model
     * @param {Object} params - { image, prompt, maxCompletionTokens }
     * @returns {Promise<import('./BaseProvider').ChatResponse>}
     */
    async analyzeImage({ image, prompt, maxCompletionTokens }) {
        const url = this.buildGeminiUrl(this.models.vision);

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

        const response = await axios.post(url, payload, {
            headers: this.getHeaders(),
            timeout: this.timeouts.requestMs
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Convert OpenAI message format to Gemini format
     * @param {Array} messages - OpenAI format messages
     * @param {string} [image] - Base64 encoded image
     * @returns {Array} Gemini format contents
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
     * Format Gemini response to standardized structure
     * @param {Object} data - Raw Gemini response
     * @returns {import('./BaseProvider').ChatResponse}
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
