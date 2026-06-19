const BaseDocumentProvider = require('./BaseDocumentProvider');
const { APIError, ErrorCodes } = require('../middleware/errorHandler');

class OpenAIDocumentProvider extends BaseDocumentProvider {
    constructor(providerConfig, documentConfig) {
        super('openai', providerConfig, documentConfig);
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('purpose', 'user_data');
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
                'OpenAI did not return an uploaded file identifier.',
                502,
                ErrorCodes.INVALID_PROVIDER_RESPONSE
            );
        }
        return data;
    }
}

module.exports = OpenAIDocumentProvider;
