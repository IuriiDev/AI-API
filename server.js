/**
 * AI API Gateway Server
 * 
 * Multi-provider AI API supporting:
 * - OpenAI (GPT-4o, GPT-4o-mini)
 * - Gemini (2.0 Flash)
 * - Grok (Beta)
 * 
 * Features:
 * - Streaming responses (SSE)
 * - Background job execution
 * - Rate limiting
 * - Retry logic
 * 
 * Architecture: SOLID principles with Strategy/Factory pattern
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// CORS Configuration
const corsOptions = {
    origin: config.cors.origins,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Body parser
app.use(express.json({ limit: config.server.bodyLimit }));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Request logging (structured, no user content)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        const requestId = `req_${Date.now().toString(36)}`;
        req.requestId = requestId;
        console.log(`[${new Date().toISOString()}] ${requestId} ${req.method} ${req.path}`);
        next();
    });
}

// API Routes
app.use('/api', routes);

// Serve frontend for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use('*', notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 AI API Gateway Started');
    console.log('═══════════════════════════════════════');
    console.log(`   Port: ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('');
    console.log('📡 API Endpoints:');
    console.log('   GET  /api              - API info & health');
    console.log('   GET  /api/providers    - List providers');
    console.log('   GET  /api/models       - List models');
    console.log('');
    console.log('   🆕 New Unified Endpoints:');
    console.log('   POST /api/ai/respond   - Chat (sync/stream/background)');
    console.log('   GET  /api/ai/jobs/:id  - Poll background job');
    console.log('');
    console.log('   📌 Legacy Endpoints:');
    console.log('   POST /api/message      - Chat completion');
    console.log('   POST /api/analyze-image - Image analysis');
    console.log('   POST /api/generate-image - Image generation');
    console.log('═══════════════════════════════════════');
    console.log('');
});

module.exports = app;
