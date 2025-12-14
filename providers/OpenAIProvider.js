/**
 * OpenAIProvider - OpenAI API Implementation
 * 
 * Implements: Single Responsibility & Liskov Substitution (SOLID)
 * 
 * Supports:
 * - Chat completions (GPT-5-nano, GPT-4o, etc.)
 * - Image analysis/vision
 * - Image generation (gpt-image-1)
 */

const axios = require('axios');
const BaseProvider = require('./BaseProvider');

class OpenAIProvider extends BaseProvider {
    constructor(config) {
        super(config);
    }

    getCapabilities() {
        return ['chat', 'vision', 'imageGeneration'];
    }

    /**
     * Chat completion (with optional vision support)
     */
    async chat({ messages, model, maxCompletionTokens, image }) {
        const url = this.buildUrl(this.endpoints.chat);

        const maxTokens = maxCompletionTokens || this.defaults.maxCompletionTokens;

        // If image provided, transform last user message for vision
        let formattedMessages = messages;
        if (image) {
            formattedMessages = this.formatMessagesWithImage(messages, image);
        }

        const payload = {
            model: image ? this.models.vision : (model || this.models.chat),
            messages: formattedMessages,
            // Support both legacy and new token parameters from the latest OpenAI docs
            // to avoid silent truncation or validation errors on different models.
            max_tokens: maxTokens,
            max_completion_tokens: maxTokens
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Format messages with image for vision
     * Converts last user message to multimodal content array
     */
    formatMessagesWithImage(messages, image) {
        const formatted = [...messages];

        // Find last user message
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
    async analyzeImage({ image, prompt, maxCompletionTokens }) {
        const url = this.buildUrl(this.endpoints.chat);

        const maxTokens = maxCompletionTokens || this.defaults.maxCompletionTokens;

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
            max_tokens: maxTokens,
            max_completion_tokens: maxTokens
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
        });

        return this.formatChatResponse(response.data);
    }

    /**
     * Image generation using gpt-image-1
     */
    async generateImage({ prompt, size, quality, outputFormat, count }) {
        const url = this.buildUrl(this.endpoints.imageGeneration);

        const payload = {
            model: this.models.imageGeneration,
            prompt: prompt.trim(),
            n: count || 1,
            size: size || '1024x1024',
            quality: quality || 'auto',
            output_format: outputFormat || 'png'
        };

        const response = await axios.post(url, payload, {
            headers: this.getHeaders()
        });

        return this.formatImageResponse(response.data);
    }

    /**
     * Format chat/vision response to standardized structure
     */
    formatChatResponse(data) {
        const rawContent = data.choices?.[0]?.message?.content;

        // OpenAI may return a string or an array of content parts (per latest docs)
        const formattedContent = this.normalizeContent(rawContent);

        return {
            provider: this.name,
            id: data.id,
            model: data.model,
            content: formattedContent || null,
            finishReason: data.choices?.[0]?.finish_reason,
            usage: data.usage,
            raw: data
        };
    }

    /**
     * Normalize OpenAI message content into a plain string
     * Handles the array-based content parts from the latest OpenAI API
     */
    normalizeContent(rawContent) {
        if (!rawContent) return null;

        if (typeof rawContent === 'string') return rawContent;

        if (!Array.isArray(rawContent)) {
            return rawContent?.text?.value || rawContent?.text || null;
        }

        const parts = rawContent
            .map(part => {
                if (typeof part === 'string') return part;

                const text = part?.text;

                // Latest OpenAI docs return { type: 'text' | 'output_text', text: '...' | { value, ... } }
                if (typeof text === 'string') return text;
                if (typeof text?.value === 'string') return text.value;

                return null;
            })
            .filter(Boolean);

        return parts.length ? parts.join(' ') : null;
    }

    /**
     * Format image generation response to standardized structure
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

