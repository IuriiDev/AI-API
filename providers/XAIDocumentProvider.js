const BaseDocumentProvider = require('./BaseDocumentProvider');
const { APIError, ErrorCodes } = require('../middleware/errorHandler');

class XAIDocumentProvider extends BaseDocumentProvider {
    constructor(providerConfig, documentConfig) {
        super('grok', providerConfig, documentConfig);
    }

    async uploadFile(file) {
        const formData = new FormData();
        // xAI requires expires_after to precede the file part.
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
}

module.exports = XAIDocumentProvider;
