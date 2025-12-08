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

const axios = require('axios');
const BaseProvider = require('./BaseProvider');

class GeminiProvider extends BaseProvider {
    constructor(config) {
        super(config);
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
     * Chat completion
     */
    async chat({ messages, model, maxCompletionTokens }) {
        const modelName = model || this.models.chat;
        const url = this.buildGeminiUrl(modelName);
        
        // Convert messages to Gemini format
        const contents = this.convertToGeminiFormat(messages);
        
        const payload = {
            contents,
            generationConfig: {
                maxOutputTokens: maxCompletionTokens || this.defaults.maxOutputTokens
            }
        };

        const response = await axios.post(url, payload, { 
            headers: this.getHeaders() 
        });

        return this.formatChatResponse(response.data);
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

        const response = await axios.post(url, payload, { 
            headers: this.getHeaders() 
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Convert OpenAI message format to Gemini format
     */
    convertToGeminiFormat(messages) {
        return messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));
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

