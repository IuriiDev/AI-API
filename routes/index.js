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

// Middleware
const { asyncHandler } = require('../middleware/errorHandler');
const { rateLimiter } = require('../middleware/rateLimiter');
const {
    validateImageAnalysisRequest,
    validateImageGenerationRequest,
    validateProvider
} = require('../middleware/validateRequest');

// Provider info
const { getAvailableProviders, getConfiguredProviders, getConfiguredModels } = require('../providers');

/**
 * Health Check & Info
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🚀 AI API Gateway is running',
        version: '3.0.0',
        availableProviders: getAvailableProviders(),
        configuredProviders: getConfiguredProviders(),
        endpoints: {
            respond: 'POST /api/ai/respond',
            jobs: 'GET /api/ai/jobs/:job_id',
            imageAnalysis: 'POST /api/analyze-image',
            imageGeneration: 'POST /api/generate-image',
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
        configured: getConfiguredProviders()
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
