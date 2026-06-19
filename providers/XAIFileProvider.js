const XAIDocumentProvider = require('./XAIDocumentProvider');

/**
 * Backward-compatible adapter for integrations that used XAIFileProvider directly.
 * New code should use the provider-neutral DocumentAnalysisService.
 */
class XAIFileProvider extends XAIDocumentProvider {
    async analyzeFiles({
        fileIds,
        prompt,
        schema = null,
        schemaName = 'document_analysis',
        model = this.defaultModel
    }) {
        this.assertSupportedModel(model);
        const response = await this.requestAnalysis({
            fileIds,
            prompt,
            responseSchema: schema,
            schemaName,
            model
        });
        return this.parseOutput(response, Boolean(schema));
    }
}

module.exports = XAIFileProvider;
