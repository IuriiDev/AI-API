const config = require('../config');
const { APIError, ErrorCodes } = require('../middleware/errorHandler');
const XAIFileProvider = require('../providers/XAIFileProvider');
const cvAnalysisSchema = require('../schemas/cvAnalysisSchema');
const { buildCVAnalysisPrompt } = require('../helpers/cvAnalysisPromptBuilder');

class CVAnalysisService {
    constructor(provider = new XAIFileProvider(config.providers.grok, config.cvAnalysis)) {
        this.provider = provider;
    }

    async analyze({ cv, coverLetter, additionalInformation }) {
        const uploadedFileIds = [];

        try {
            const uploadedCV = await this.provider.uploadFile(cv);
            uploadedFileIds.push(uploadedCV.id);

            if (coverLetter) {
                const uploadedCoverLetter = await this.provider.uploadFile(coverLetter);
                uploadedFileIds.push(uploadedCoverLetter.id);
            }

            const prompt = buildCVAnalysisPrompt({
                cvFileName: cv.originalname,
                coverLetterFileName: coverLetter?.originalname,
                additionalInformation
            });
            const analysis = await this.provider.analyzeFiles({
                fileIds: uploadedFileIds,
                prompt,
                schema: cvAnalysisSchema
            });
            this.validateAnalysis(analysis);
            return analysis;
        } finally {
            await this.deleteUploadedFiles(uploadedFileIds);
        }
    }

    validateAnalysis(analysis) {
        if (!analysis
            || !Number.isInteger(analysis.overall_score)
            || !Array.isArray(analysis.breakdown)
            || !analysis.candidate_profile) {
            throw new APIError(
                'xAI returned an incomplete CV analysis.',
                502,
                ErrorCodes.INVALID_PROVIDER_RESPONSE
            );
        }
    }

    async deleteUploadedFiles(fileIds) {
        const results = await Promise.allSettled(
            fileIds.map(fileId => this.provider.deleteFile(fileId))
        );

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.warn(`Failed to delete temporary xAI file ${fileIds[index]}.`);
            }
        });
    }
}

module.exports = CVAnalysisService;
