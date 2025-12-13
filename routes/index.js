/**
 * API Routes
 * 
 * Centralizes all route definitions
 * Easy to add new endpoints or versioning
 */

const express = require('express');
const router = express.Router();

// Controllers
const { handleChat, handleStreamChat } = require('../controllers/chatController');
const { handleImageAnalysis } = require('../controllers/imageAnalysisController');
const { handleImageGeneration } = require('../controllers/imageGenerationController');

// Middleware
const { asyncHandler } = require('../middleware/errorHandler');
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
        version: '2.0.0',
        availableProviders: getAvailableProviders(),
        configuredProviders: getConfiguredProviders(),
        endpoints: {
            chat: 'POST /api/message',
            chatStream: 'POST /api/message/stream',
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

/**
 * Chat Completion (Standard)
 * POST /api/message
 */
router.post('/message',
    validateProvider,
    validateChatRequest,
    asyncHandler(handleChat)
);

/**
 * Chat Completion (Streaming SSE)
 * POST /api/message/stream
 */
router.post('/message/stream',
    validateProvider,
    validateChatRequest,
    handleStreamChat  // No asyncHandler - streaming handles its own errors
);

/**
 * Image Analysis (Vision)
 * POST /api/analyze-image
 */
router.post('/analyze-image',
    validateProvider,
    validateImageAnalysisRequest,
    asyncHandler(handleImageAnalysis)
);

/**
 * Image Generation
 * POST /api/generate-image
 */
router.post('/generate-image',
    validateProvider,
    validateImageGenerationRequest,
    asyncHandler(handleImageGeneration)
);

module.exports = router;

