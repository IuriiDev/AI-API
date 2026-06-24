/**
 * API Routes
 * 
 * Centralizes all route definitions
 * Clean architecture with unified AI endpoint
 */

const express = require('express');
const router = express.Router();

// Controllers
const { handleRespond } = require('../controllers/respondController');
const { handleGetJob } = require('../controllers/jobController');
const { handleImageAnalysis } = require('../controllers/imageAnalysisController');
const { handleImageGeneration } = require('../controllers/imageGenerationController');
const { handleDocumentAnalysis } = require('../controllers/documentAnalysisController');

// Middleware
const { asyncHandler } = require('../middleware/errorHandler');
const { rateLimiter } = require('../middleware/rateLimiter');
<<<<<<< HEAD
const { requireDocumentAnalysisAuth } = require('../middleware/documentAnalysisAuth');
=======
>>>>>>> 10c6d1393560111d9127ea10b639cf2e6071d8c9
const { handleDocumentAnalysisUpload } = require('../middleware/documentAnalysisUpload');
const {
    validateDocumentAnalysisRequest
} = require('../middleware/validateDocumentAnalysisRequest');
const {
    validateImageAnalysisRequest,
    validateImageGenerationRequest,
    validateProvider
} = require('../middleware/validateRequest');

// Provider info
const {
    getAvailableProviders,
    getConfiguredProviders,
    getConfiguredModels,
    getProviderCatalog
} = require('../providers');

/**
 * Health Check & Info
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'AI API Gateway is running',
        version: '3.1.0',
        availableProviders: getAvailableProviders(),
        configuredProviders: getConfiguredProviders(),
        endpoints: {
            respond: 'POST /api/ai/respond',
            jobs: 'GET /api/ai/jobs/:job_id',
            imageAnalysis: 'POST /api/analyze-image',
            imageGeneration: 'POST /api/generate-image',
            documentAnalysis: 'POST /api/document-analysis',
            providers: 'GET /api/providers',
            models: 'GET /api/models'
        }
    });
});

/**
 * Get available providers
 */
router.get('/providers', (req, res) => {
    res.json({
        success: true,
        available: getAvailableProviders(),
        configured: getConfiguredProviders(),
        providers: getProviderCatalog()
    });
});

/**
 * Get available models with display names (hierarchical)
 */
router.get('/models', (req, res) => {
    res.json({
        success: true,
        providers: getConfiguredModels()
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// AI CHAT ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * AI Respond - Unified chat endpoint
 * POST /api/ai/respond
 * 
 * Body:
 * - messages: array of { role, content }
 * - model: string (optional)
 * - provider: string (optional, default: 'openai')
 * - image: string (optional, base64 encoded)
 * - stream: boolean (optional, SSE streaming)
 * - background: boolean (optional, async job)
 */
router.post('/ai/respond',
    rateLimiter,
    validateProvider,
    asyncHandler(handleRespond)
);

/**
 * Job Status - Poll background job
 * GET /api/ai/jobs/:job_id
 */
router.get('/ai/jobs/:job_id',
    asyncHandler(handleGetJob)
);

router.post('/document-analysis',
    rateLimiter,
<<<<<<< HEAD
    requireDocumentAnalysisAuth,
=======
>>>>>>> 10c6d1393560111d9127ea10b639cf2e6071d8c9
    handleDocumentAnalysisUpload,
    validateDocumentAnalysisRequest,
    asyncHandler(handleDocumentAnalysis)
);

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Image Analysis (Vision)
 * POST /api/analyze-image
 */
router.post('/analyze-image',
    rateLimiter,
    validateProvider,
    validateImageAnalysisRequest,
    asyncHandler(handleImageAnalysis)
);

/**
 * Image Generation
 * POST /api/generate-image
 */
router.post('/generate-image',
    rateLimiter,
    validateProvider,
    validateImageGenerationRequest,
    asyncHandler(handleImageGeneration)
);

module.exports = router;
