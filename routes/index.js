/**
 * API Routes
 * 
 * Centralizes all route definitions
 * Easy to add new endpoints or versioning
 */

const express = require('express');
const router = express.Router();

// Controllers
const { handleChat } = require('../controllers/chatController');
const { handleImageAnalysis } = require('../controllers/imageAnalysisController');
const { handleImageGeneration } = require('../controllers/imageGenerationController');
const { handleRespond } = require('../controllers/respondController');
const { handleGetJob } = require('../controllers/jobController');

// Middleware
const { asyncHandler } = require('../middleware/errorHandler');
const { rateLimiter } = require('../middleware/rateLimiter');
const {
    validateChatRequest,
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
        version: '2.1.0',
        availableProviders: getAvailableProviders(),
        configuredProviders: getConfiguredProviders(),
        endpoints: {
            // New unified endpoint
            respond: 'POST /api/ai/respond',
            jobs: 'GET /api/ai/jobs/:job_id',
            // Legacy endpoints
            chat: 'POST /api/message',
            imageAnalysis: 'POST /api/analyze-image',
            imageGeneration: 'POST /api/generate-image',
            providers: 'GET /api/providers'
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
// NEW AI ENDPOINTS (with rate limiting)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * AI Respond - Unified endpoint
 * POST /api/ai/respond
 * 
 * Supports: synchronous, streaming (SSE), background jobs
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
// LEGACY ENDPOINTS (kept for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Chat Completion
 * POST /api/message
 */
router.post('/message',
    rateLimiter,
    validateProvider,
    validateChatRequest,
    asyncHandler(handleChat)
);

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
