const config = require('../config');
const { APIError, ErrorCodes } = require('../middleware/errorHandler');
const CVAnalysisService = require('../services/CVAnalysisService');

const cvAnalysisService = new CVAnalysisService();

async function handleCVAnalysis(req, res) {
    const cv = req.files?.cv?.[0];
    const coverLetter = req.files?.cover_letter?.[0];
    const additionalInformation = normalizedAdditionalInformation(
        req.body?.additional_information
    );

    if (!cv) {
        throw new APIError(
            'A CV document is required.',
            400,
            ErrorCodes.CV_REQUIRED
        );
    }

    const analysis = await cvAnalysisService.analyze({
        cv,
        coverLetter,
        additionalInformation
    });

    res.json({
        success: true,
        analysis
    });
}

function normalizedAdditionalInformation(value) {
    if (value === undefined) {
        return null;
    }
    if (typeof value !== 'string') {
        throw new APIError(
            'Additional information must be text.',
            400,
            ErrorCodes.INVALID_INPUT
        );
    }

    const normalizedValue = value.trim();
    if (normalizedValue.length > config.cvAnalysis.maximumAdditionalInformationLength) {
        throw new APIError(
            `Additional information cannot exceed ${config.cvAnalysis.maximumAdditionalInformationLength} characters.`,
            400,
            ErrorCodes.INPUT_TOO_LONG
        );
    }
    return normalizedValue || null;
}

module.exports = { handleCVAnalysis };
