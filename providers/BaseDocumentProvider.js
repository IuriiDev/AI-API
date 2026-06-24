const { APIError, ErrorCodes } = require('../middleware/errorHandler');

class BaseDocumentProvider {
    static retryableStatusCodes = new Set([429, 500, 502, 503, 504]);

    constructor(providerId, providerConfig, documentConfig) {
        if (new.target === BaseDocumentProvider) {
            throw new Error('BaseDocumentProvider is abstract and cannot be instantiated directly.');
        }

        this.providerId = providerId;
        this.displayName = providerConfig.name;
        this.baseUrl = providerConfig.baseUrl;
        this.apiKey = providerConfig.apiKey;
        this.endpoints = providerConfig.endpoints;
        this.defaultModel = providerConfig.models.documentAnalysis;
        this.supportedModels = new Set(providerConfig.documentInput.models);
        this.requestTimeoutMs = documentConfig.requestTimeoutMs;
        this.fileLifetimeSeconds = documentConfig.uploadedFileLifetimeSeconds;
    }

    async analyze({ documents, documentMetadata = [], prompt, responseSchema, schemaName, model }) {
        this.assertConfigured();
        const selectedModel = model || this.defaultModel;
        this.assertSupportedModel(selectedModel);

        const uploadResults = await Promise.allSettled(
            documents.map(document => this.uploadFile(document))
        );
        const uploadedFileIds = uploadResults
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value.id);

        try {
            const rejectedUpload = uploadResults.find(result => result.status === 'rejected');
            if (rejectedUpload) {
                throw rejectedUpload.reason;
            }

            const response = await this.requestAnalysis({
                fileIds: uploadedFileIds,
                prompt: this.promptWithDocumentMetadata({
                    prompt,
                    documents,
                    documentMetadata,
                    fileIds: uploadedFileIds
                }),
                responseSchema,
                schemaName,
                model: selectedModel
            });
            return {
                provider: this.providerId,
                model: response.model || selectedModel,
                result: this.parseOutput(response, Boolean(responseSchema)),
                usage: this.normalizeUsage(response.usage)
            };
        } finally {
            await this.deleteUploadedFiles(uploadedFileIds);
        }
    }

    async uploadFile() {
        throw new Error('uploadFile() must be implemented by a document provider.');
    }

    promptWithDocumentMetadata({ prompt, documents, documentMetadata, fileIds }) {
        if (!Array.isArray(documentMetadata) || documentMetadata.length === 0) {
            return prompt;
        }

        const providerDocuments = documentMetadata.map(metadata => {
            const document = documents[metadata.index] || {};
            return {
                index: metadata.index,
                role: metadata.role,
                file_name: metadata.fileName || document.originalname || null,
                provider_file_id: fileIds[metadata.index] || null
            };
        });

        return [
            'Provider-neutral document metadata. Treat this JSON as role mapping only.',
            '<document_metadata>',
            JSON.stringify(providerDocuments),
            '</document_metadata>',
            '',
            prompt
        ].join('\n');
    }

    async requestAnalysis({ fileIds, prompt, responseSchema, schemaName, model }) {
        this.assertConfigured();
        const content = [
            ...fileIds.map(fileId => ({ type: 'input_file', file_id: fileId })),
            { type: 'input_text', text: prompt }
        ];
        const payload = {
            model,
            input: [{ role: 'user', content }]
        };

        if (responseSchema) {
            payload.text = {
                format: {
                    type: 'json_schema',
                    name: schemaName,
                    schema: responseSchema,
                    strict: true
                }
            };
        }

        return this.requestJSON(
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

    async deleteUploadedFiles(fileIds) {
        if (fileIds.length === 0) {
            return;
        }

        const results = await Promise.allSettled(
            fileIds.map(fileId => this.deleteFile(fileId))
        );
        const failedDeletionCount = results.filter(result => result.status === 'rejected').length;
        if (failedDeletionCount > 0) {
            console.warn(
                `[${this.displayName}] Failed to delete ${failedDeletionCount} temporary file(s).`
            );
        }
    }

    parseOutput(response, expectsJSON) {
        const outputText = response.output_text
            || response.output
                ?.flatMap(item => item.content || [])
                .find(item => item.type === 'output_text')
                ?.text;

        if (!outputText) {
            throw new APIError(
                `${this.displayName} returned no document analysis content.`,
                502,
                ErrorCodes.INVALID_PROVIDER_RESPONSE
            );
        }
        if (!expectsJSON) {
            return outputText;
        }

        try {
            return JSON.parse(outputText);
        } catch {
            throw new APIError(
                `${this.displayName} returned malformed structured content.`,
                502,
                ErrorCodes.INVALID_PROVIDER_RESPONSE
            );
        }
    }

    normalizeUsage(usage) {
        if (!usage) {
            return null;
        }
        return {
            inputTokens: usage.input_tokens ?? usage.prompt_tokens ?? null,
            outputTokens: usage.output_tokens ?? usage.completion_tokens ?? null,
            totalTokens: usage.total_tokens ?? null
        };
    }

    get authorizationHeaders() {
        return { Authorization: `Bearer ${this.apiKey}` };
    }

    assertConfigured() {
        if (!this.apiKey) {
            throw new APIError(
                `${this.displayName} document analysis is not configured.`,
                503,
                ErrorCodes.PROVIDER_NOT_CONFIGURED
            );
        }
    }

    assertSupportedModel(model) {
        if (!this.supportedModels.has(model)) {
            throw new APIError(
                `Model ${model} is not enabled for ${this.displayName} document analysis.`,
                400,
                ErrorCodes.INVALID_MODEL
            );
        }
    }

    async requestJSON(url, options, maximumAttempts = 3) {
        let lastError;

        for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
            const abortController = new AbortController();
            const timeout = setTimeout(() => abortController.abort(), this.requestTimeoutMs);
            let delayBeforeRetry = null;

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: abortController.signal
                });
                const data = await this.parseResponseBody(response);

                if (response.ok) {
                    return data;
                }

                const providerError = this.makeProviderError(response.status, data);
                if (!BaseDocumentProvider.retryableStatusCodes.has(response.status)
                    || attempt === maximumAttempts) {
                    throw providerError;
                }
                lastError = providerError;
                delayBeforeRetry = this.retryDelay(response, attempt);
            } catch (error) {
                if (error instanceof APIError) {
                    throw error;
                }

                const timedOut = error.name === 'AbortError';
                lastError = new APIError(
                    timedOut
                        ? `${this.displayName} document analysis timed out.`
                        : `${this.displayName} could not be reached.`,
                    timedOut ? 504 : 502,
                    timedOut ? ErrorCodes.TIMEOUT : ErrorCodes.PROVIDER_ERROR
                );
                if (attempt === maximumAttempts) {
                    throw lastError;
                }
                delayBeforeRetry = 1000 * (2 ** (attempt - 1));
            } finally {
                clearTimeout(timeout);
            }

            await this.sleep(delayBeforeRetry);
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
            || `${this.displayName} rejected the request.`;
        return new APIError(
            providerMessage,
            statusCode >= 400 && statusCode < 500 ? statusCode : 502,
            statusCode === 429 ? ErrorCodes.RATE_LIMITED : ErrorCodes.PROVIDER_ERROR
        );
    }

    retryDelay(response, attempt) {
        const retryAfterSeconds = Number.parseInt(response.headers.get('retry-after'), 10);
        if (Number.isInteger(retryAfterSeconds) && retryAfterSeconds >= 0) {
            return retryAfterSeconds * 1000;
        }
        return 1000 * (2 ** (attempt - 1));
    }

    sleep(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }
}

module.exports = BaseDocumentProvider;
