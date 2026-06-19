const { getDocumentProvider } = require('../providers/documentProviders');

class DocumentAnalysisService {
    constructor(providerFactory = getDocumentProvider) {
        this.providerFactory = providerFactory;
    }

    async analyze(request) {
        const provider = this.providerFactory(request.provider);
        return provider.analyze(request);
    }
}

module.exports = DocumentAnalysisService;
