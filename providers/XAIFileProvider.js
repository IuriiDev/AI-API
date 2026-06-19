const { APIError, ErrorCodes } = require('../middleware/errorHandler');

class XAIFileProvider {
    static retryableStatusCodes = new Set([429, 500, 502, 503, 504]);

    constructor(providerConfig, analysisConfig) {
        this.baseUrl = providerConfig.baseUrl;
        this.apiKey = providerConfig.apiKey;
        this.endpoints = providerConfig.endpoints;
        this.model = providerConfig.models.documentAnalysis;
        this.requestTimeoutMs = analysisConfig.requestTimeoutMs;
        this.fileLifetimeSeconds = analysisConfig.uploadedFileLifetimeSeconds;
    }

    async uploadFile(file) {
        this.assertConfigured();

        const formData = new FormData();
        // xAI requires expires_after to appear before the file part.
        formData.append('expires_after', String(this.fileLifetimeSeconds));
        formData.append('purpose', 'assistants');
        formData.append(
            'file',
            new Blob([file.buffer], { type: file.mimetype }),
            file.originalname
        );

        const data = await this.requestJSON(
            `${this.baseUrl}${this.endpoints.files}`,
            {
                method: 'POST',
                headers: this.authorizationHeaders,
                body: formData
            }
        );

        if (!data.id) {
            throw new APIError(
                'xAI did not return an uploaded file identifier.',
                502,
                ErrorCodes.INVALID_PROVIDER_RESPONSE
            );
        }
        return data;
    }

    async analyzeFiles({ fileIds, prompt, schema }) {
        this.assertConfigured();

        const content = [
            { type: 'input_text', text: prompt },
            ...fileIds.map(fileId => ({ type: 'input_file', file_id: fileId }))
        ];
        const payload = {
            model: this.model,
            input: [{ role: 'user', content }],
            text: {
                format: {
                    type: 'json_schema',
                    name: 'cv_analysis',
                    schema,
                    strict: true
                }
            }
        };

        const data = await this.requestJSON(
            `${this.baseUrl}${this.endpoints.responses}`,
            {
                method: 'POST',
                headers: {
                    ...this.authorizationHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );

        const message = data.output?.find(item => item.type === 'message');
        const outputText = message?.content?.find(item => item.type === 'output_text')?.text;
        if (!outputText) {
            throw new APIError(
                'xAI returned no CV analysis content.',
                502,
                ErrorCodes.INVALID_PROVIDER_RESPONSE
            );
        }

        try {
            return JSON.parse(outputText);
        } catch {
            throw new APIError(
                'xAI returned malformed CV analysis content.',
                502,
                ErrorCodes.INVALID_PROVIDER_RESPONSE
            );
        }
    }

    async deleteFile(fileId) {
        this.assertConfigured();
        await this.requestJSON(
            `${this.baseUrl}${this.endpoints.files}/${encodeURIComponent(fileId)}`,
            {
                method: 'DELETE',
                headers: this.authorizationHeaders
            },
            2
        );
    }

    get authorizationHeaders() {
        return { Authorization: `Bearer ${this.apiKey}` };
    }

    assertConfigured() {
        if (!this.apiKey) {
            throw new APIError(
                'xAI is not configured. Set the XAI_API_KEY environment variable.',
                503,
                ErrorCodes.PROVIDER_ERROR
            );
        }
    }

    async requestJSON(url, options, maximumAttempts = 3) {
        let lastError;

        for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
            const abortController = new AbortController();
            const timeout = setTimeout(
                () => abortController.abort(),
                this.requestTimeoutMs
            );

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: abortController.signal
                });
                const data = await this.parseResponseBody(response);

                if (response.ok) {
                    return data;
                }

                const error = this.makeProviderError(response.status, data);
                if (!XAIFileProvider.retryableStatusCodes.has(response.status)
                    || attempt === maximumAttempts) {
                    throw error;
                }
                lastError = error;
            } catch (error) {
                if (error instanceof APIError) {
                    throw error;
                }

                const isTimeout = error.name === 'AbortError';
                lastError = new APIError(
                    isTimeout
                        ? 'The xAI request timed out.'
                        : 'The xAI service could not be reached.',
                    isTimeout ? 504 : 502,
                    isTimeout ? ErrorCodes.TIMEOUT : ErrorCodes.PROVIDER_ERROR
                );
                if (attempt === maximumAttempts) {
                    throw lastError;
                }
            } finally {
                clearTimeout(timeout);
            }

            await this.sleep(1000 * (2 ** (attempt - 1)));
        }

        throw lastError;
    }

    async parseResponseBody(response) {
        if (response.status === 204) {
            return {};
        }
        const responseText = await response.text();
        if (!responseText) {
            return {};
        }
        try {
            return JSON.parse(responseText);
        } catch {
            return { message: responseText };
        }
    }

    makeProviderError(statusCode, data) {
        const providerMessage = data?.error?.message
            || data?.message
            || 'The xAI request failed.';
        return new APIError(
            providerMessage,
            statusCode,
            statusCode === 429 ? ErrorCodes.RATE_LIMITED : ErrorCodes.PROVIDER_ERROR,
            data?.error
        );
    }

    sleep(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }
}

module.exports = XAIFileProvider;
