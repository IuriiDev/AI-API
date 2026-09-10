/**
 * OpenAIProvider - OpenAI API Implementation
 * 
 * Implements: Single Responsibility & Liskov Substitution (SOLID)
 * 
 * Supports:
 * - Chat completions (GPT-5.6, GPT-5.6 Sol/Terra/Luna, GPT-5.5, GPT-5.4, GPT-5, and legacy variants)
 * - Streaming responses (SSE)
 * - Image analysis/vision
 * - Image generation (GPT Image 2)
 * - Retry logic with exponential backoff (inherited from BaseProvider)
 */

const axios = require('axios');
const BaseProvider = require('./BaseProvider');
const { extractDxf } = require('../utils/dxf');

class OpenAIProvider extends BaseProvider {

    getCapabilities() {
        return ['chat', 'vision', 'documentInput', 'imageGeneration', 'streaming'];
    }

    /**
     * Chat completion (with optional vision support)
     * @param {import('./BaseProvider').ChatParams} params
     * @returns {Promise<import('./BaseProvider').ChatResponse>}
     */
    async chat({ messages, model, maxCompletionTokens, maxTokens, image, responseFormat, tools, toolChoice, metadata }) {
        const url = this.buildUrl(this.endpoints.chat);

        // If image provided, transform messages for vision
        const formattedMessages = image
            ? this.formatMessagesWithImage(messages, image)
            : messages;

        const normalizedResponseFormat = typeof responseFormat === 'string'
            ? { type: responseFormat }
            : responseFormat;

        const payload = {
            model: this.resolveChatModel(model, image),
            messages: formattedMessages,
            max_completion_tokens: this.resolveMaxOutputTokens(maxCompletionTokens, maxTokens),
            response_format: normalizedResponseFormat,
            tools,
            tool_choice: toolChoice,
            metadata
        };

        const response = await this.requestWithRetry(url, payload);
        return this.formatChatResponse(response.data);
    }

    /**
     * Streaming chat completion with vision support
     * @param {import('./BaseProvider').ChatParams} params
     * @param {Function} onChunk - Callback for each text chunk
     */
    async chatStream({ messages, model, maxCompletionTokens, maxTokens, image, responseFormat, tools, toolChoice, metadata }, onChunk) {
        const url = this.buildUrl(this.endpoints.chat);

        // If image provided, transform messages for vision
        const formattedMessages = image
            ? this.formatMessagesWithImage(messages, image)
            : messages;

        const normalizedResponseFormat = typeof responseFormat === 'string'
            ? { type: responseFormat }
            : responseFormat;

        const payload = {
            model: this.resolveChatModel(model, image),
            messages: formattedMessages,
            max_completion_tokens: this.resolveMaxOutputTokens(maxCompletionTokens, maxTokens),
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
                            const delta = parsed.choices?.[0]?.delta;
                            const content = Array.isArray(delta?.content)
                                ? delta.content.map(part => part?.text || part?.content || '').join('')
                                : delta?.content;
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
     * Image generation using GPT Image 2
     * @param {Object} params - { prompt, size, quality, count }
     * @returns {Promise<Object>}
     */
    async generateImage({ prompt, size, quality, outputFormat, count }) {
        const url = this.buildUrl(this.endpoints.imageGeneration);

        const payload = {
            model: this.models.imageGeneration,
            prompt: prompt.trim(),
            n: count || 1,
            size: size || '1024x1024',
            quality: quality || 'medium',
            output_format: outputFormat || 'png'
        };

        const response = await this.requestWithRetry(url, payload);
        return this.formatImageResponse(response.data);
    }

    /**
     * Ask the model to write a DXF with Code Interpreter, then download the file.
     * Falls back to chat-pasted DXF text if no container file is produced.
     * @param {import('./BaseProvider').ChatParams} params
     * @returns {Promise<{ buffer: Buffer, fileName: string, text: string|null, raw: Object|null }>}
     */
    async generateDxfFile({ messages, model, maxCompletionTokens, maxTokens, image }) {
        const url = this.buildUrl(this.endpoints.responses);
        const prompt = this.lastUserText(messages);
        const content = [{ type: 'input_text', text: prompt }];
        if (image) {
            content.push({
                type: 'input_image',
                image_url: this.getBase64ImageUrl(image),
                detail: 'high'
            });
        }

        const payload = {
            model: this.resolveChatModel(model, image),
            instructions: [
                'Use the python tool and ezdxf to create a new AutoCAD R2004 drawing.',
                'Call ezdxf.new("R2004", setup=True), add detailed colored geometry to modelspace, then save drawing.dxf.',
                'Trace the photo accurately. Do not hand-write DXF group codes or a minimal DXF. Do not paste DXF into the chat.'
            ].join(' '),
            input: [{ role: 'user', content }],
            tools: [{
                type: 'code_interpreter',
                container: { type: 'auto' }
            }],
            tool_choice: 'required',
            max_output_tokens: this.resolveMaxOutputTokens(maxCompletionTokens, maxTokens)
        };

        let data;
        try {
            const response = await this.requestWithRetry(url, payload);
            data = response.data;
        } catch (error) {
            console.warn(`[OpenAI] DXF file generation failed, falling back to chat: ${error.message}`);
            return super.generateDxfFile({ messages, model, maxCompletionTokens, maxTokens, image });
        }

        const text = this.extractResponsesText(data);
        const downloaded = await this.downloadGeneratedDxf(data);
        if (downloaded) {
            return {
                buffer: downloaded.buffer,
                fileName: downloaded.fileName,
                text,
                raw: data
            };
        }

        const dxf = extractDxf(text);
        if (dxf) {
            return {
                buffer: Buffer.from(dxf, 'utf8'),
                fileName: 'drawing.dxf',
                text,
                raw: data
            };
        }
        throw new Error('OpenAI did not return a DXF file.');
    }

    lastUserText(messages = []) {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            if (messages[index]?.role === 'user' && typeof messages[index].content === 'string') {
                return messages[index].content;
            }
        }
        return '';
    }

    extractResponsesText(data) {
        if (typeof data?.output_text === 'string' && data.output_text.trim()) {
            return data.output_text;
        }
        const parts = (data?.output || [])
            .flatMap(item => item?.content || [])
            .map(part => part?.text || '')
            .filter(Boolean);
        return parts.join('\n') || null;
    }

    collectGeneratedFiles(data) {
        const files = [];
        const seen = new Set();
        const containerIds = new Set();
        const stack = [data];

        while (stack.length > 0) {
            const node = stack.pop();
            if (!node || typeof node !== 'object') {
                continue;
            }
            if (Array.isArray(node)) {
                stack.push(...node);
                continue;
            }
            if (node.type === 'code_interpreter_call' && node.container_id) {
                containerIds.add(node.container_id);
            }
            if (node.container_id && node.file_id) {
                const key = `${node.container_id}:${node.file_id}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    files.push({
                        containerId: node.container_id,
                        fileId: node.file_id,
                        fileName: node.filename || node.file_name || node.path || 'drawing.dxf'
                    });
                }
                containerIds.add(node.container_id);
            }
            for (const value of Object.values(node)) {
                if (value && typeof value === 'object') {
                    stack.push(value);
                }
            }
        }

        return { files, containerIds: [...containerIds] };
    }

    async listContainerFiles(containerId) {
        const url = this.buildUrl(`/containers/${encodeURIComponent(containerId)}/files`);
        const response = await axios.get(url, {
            headers: this.getHeaders(),
            timeout: this.timeouts.requestMs
        });
        return response.data?.data || [];
    }

    async downloadContainerFile(containerId, fileId) {
        const url = this.buildUrl(
            `/containers/${encodeURIComponent(containerId)}/files/${encodeURIComponent(fileId)}/content`
        );
        const response = await axios.get(url, {
            headers: {
                ...this.getHeaders(),
                Accept: 'application/binary'
            },
            timeout: this.timeouts.requestMs,
            responseType: 'arraybuffer'
        });
        return Buffer.from(response.data);
    }

    looksLikeDxfFileName(name = '') {
        return /\.dxf$/i.test(name);
    }

    isProbablyDxfBuffer(buffer) {
        if (!buffer || buffer.length < 16) {
            return false;
        }
        return Boolean(extractDxf(buffer.toString('utf8')));
    }

    async downloadGeneratedDxf(data) {
        const { files, containerIds } = this.collectGeneratedFiles(data);
        const candidates = [...files];

        for (const containerId of containerIds) {
            try {
                const listed = await this.listContainerFiles(containerId);
                for (const item of listed) {
                    const fileId = item.id;
                    if (!fileId) {
                        continue;
                    }
                    const fileName = item.path || item.filename || 'drawing.dxf';
                    const key = `${containerId}:${fileId}`;
                    if (!candidates.some(file => `${file.containerId}:${file.fileId}` === key)) {
                        candidates.push({ containerId, fileId, fileName });
                    }
                }
            } catch (error) {
                console.warn(`[OpenAI] Could not list container files: ${error.message}`);
            }
        }

        const ranked = candidates.sort((left, right) => {
            const leftScore = this.looksLikeDxfFileName(left.fileName) ? 0 : 1;
            const rightScore = this.looksLikeDxfFileName(right.fileName) ? 0 : 1;
            return leftScore - rightScore;
        });

        for (const candidate of ranked) {
            if (/\.(png|jpe?g|gif|webp)$/i.test(candidate.fileName)) {
                continue;
            }
            try {
                const buffer = await this.downloadContainerFile(candidate.containerId, candidate.fileId);
                if (this.looksLikeDxfFileName(candidate.fileName) || this.isProbablyDxfBuffer(buffer)) {
                    const fileName = this.looksLikeDxfFileName(candidate.fileName)
                        ? candidate.fileName.split('/').pop()
                        : 'drawing.dxf';
                    return { buffer, fileName };
                }
            } catch (error) {
                console.warn(`[OpenAI] Could not download ${candidate.fileName}: ${error.message}`);
            }
        }

        return null;
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
