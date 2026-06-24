const { timingSafeEqual } = require('crypto');
const config = require('../config');
const { APIError, ErrorCodes } = require('./errorHandler');

function requireDocumentAnalysisAuth(request, _response, next) {
    const expectedToken = config.documentAnalysis.appAuthToken;
    if (!expectedToken) {
        next();
        return;
    }

    const providedToken = extractBearerToken(request.headers.authorization);
    if (!providedToken || !constantTimeEquals(providedToken, expectedToken)) {
        next(new APIError(
            'Document analysis is not authorized.',
            401,
            ErrorCodes.UNAUTHORIZED
        ));
        return;
    }

    next();
}

function extractBearerToken(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const [scheme, token] = value.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        return null;
    }
    return token.trim() || null;
}

function constantTimeEquals(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
}

module.exports = { requireDocumentAnalysisAuth };
