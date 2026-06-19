const DocumentAnalysisService = require('../services/DocumentAnalysisService');

const documentAnalysisService = new DocumentAnalysisService();

async function handleDocumentAnalysis(request, response) {
    const analysis = await documentAnalysisService.analyze(
        request.documentAnalysisRequest
    );
    response.json({
        success: true,
        ...analysis
    });
}

module.exports = { handleDocumentAnalysis };
