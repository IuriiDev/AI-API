/**
 * GeminiProvider - Google Gemini API Implementation
 * 
 * API: https://generativelanguage.googleapis.com/v1beta
 * Auth: API key in URL parameter (not header)
 *
 * Models:
 * - gemini-3-pro-preview (multimodal)
 * - gemini-2.5-pro (multimodal)
 * - gemini-2.5-flash (multimodal, 1M context)
 * - gemini-2.5-flash-lite (multimodal)
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
        return ['chat', 'vision', 'streaming'];
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
    buildGeminiUrl(model, action = 'generateContent') {
        return `${this.baseUrl}/models/${model}:${action}?key=${this.apiKey}`;
    }

    /**
     * Chat completion (with optional vision support)
     * @param {import('./BaseProvider').ChatParams} params
     * @returns {Promise<import('./BaseProvider').ChatResponse>}
     */
    async chat({ messages, model, maxCompletionTokens, image, responseFormat, tools, toolChoice }) {
        const modelName = image ? this.models.vision : (model || this.models.chat);
        const url = this.buildGeminiUrl(modelName);

        // Convert messages to Gemini format (with optional image)
        const contents = this.convertToGeminiFormat(messages, image);

        const functionDeclarations = this.convertTools(tools);
        const toolConfig = this.buildToolConfig(functionDeclarations, toolChoice);

        const payload = {
            contents,
            generationConfig: {
                maxOutputTokens: maxCompletionTokens || this.defaults.maxOutputTokens,
                responseMimeType: this.resolveResponseMimeType(responseFormat)
            },
            tools: functionDeclarations,
            toolConfig
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
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
            headers: this.getHeaders()
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Streaming chat completion
     */
    async chatStream({ messages, model, maxCompletionTokens, image, responseFormat, tools, toolChoice }, onChunk) {
        const modelName = image ? this.models.vision : (model || this.models.chat);
        const url = this.buildGeminiUrl(modelName, 'streamGenerateContent');

        const contents = this.convertToGeminiFormat(messages, image);
        const functionDeclarations = this.convertTools(tools);
        const toolConfig = this.buildToolConfig(functionDeclarations, toolChoice);

        const payload = {
            contents,
            generationConfig: {
                maxOutputTokens: maxCompletionTokens || this.defaults.maxOutputTokens,
                responseMimeType: this.resolveResponseMimeType(responseFormat)
            },
            tools: functionDeclarations,
            toolConfig,
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
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const part = parsed.candidates?.[0]?.content?.parts?.[0];
                        if (part?.text) {
                            onChunk(part.text);
                        }
                    } catch {
                        // Ignore malformed streaming chunks
                    }
                }
            });

            response.data.on('end', resolve);
            response.data.on('error', reject);
        });
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
     * Convert OpenAI tool schema to Gemini function declarations
     * @param {Object[]} tools
     * @returns {Object[]|undefined}
     */
    convertTools(tools) {
        if (!Array.isArray(tools) || tools.length === 0) return undefined;
        const functionDeclarations = tools
            .filter(tool => tool.type === 'function')
            .map(tool => ({
                name: tool.function?.name,
                description: tool.function?.description,
                parameters: tool.function?.parameters
            }))
            .filter(fn => fn.name);

        if (functionDeclarations.length === 0) return undefined;
        return [{ functionDeclarations }];
    }

    /**
     * Build tool configuration for Gemini
     * @param {Object[]|undefined} functionDeclarations
     * @param {'auto'|'none'|Object} toolChoice
     * @returns {Object|undefined}
     */
    buildToolConfig(functionDeclarations, toolChoice) {
        if (!functionDeclarations || functionDeclarations.length === 0) return undefined;

        const names = functionDeclarations
            .flatMap(tool => tool.functionDeclarations || [])
            .map(fn => fn.name)
            .filter(Boolean);

        if (names.length === 0) return undefined;

        const config = { mode: 'AUTO' };
        if (toolChoice === 'none') {
            config.mode = 'NONE';
        } else if (toolChoice && typeof toolChoice === 'object') {
            const name = toolChoice.function?.name;
            if (name) {
                config.allowedFunctionNames = [name];
                config.mode = 'ANY';
            }
        }

        return { functionCallingConfig: config };
    }

    /**
     * Resolve response mime type from OpenAI-style response format
     * @param {Object|string} responseFormat
     * @returns {string|undefined}
     */
    resolveResponseMimeType(responseFormat) {
        if (!responseFormat) return undefined;
        if (typeof responseFormat === 'string' && responseFormat === 'json_object') {
            return 'application/json';
        }
        if (typeof responseFormat === 'object' && responseFormat.type === 'json_object') {
            return 'application/json';
        }
        return undefined;
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
            toolCalls: data.candidates?.[0]?.content?.parts?.[0]?.functionCall ? [data.candidates[0].content.parts[0].functionCall] : [],
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
