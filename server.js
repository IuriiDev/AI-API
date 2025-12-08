/**
 * AI API Gateway Server
 * 
 * Multi-provider AI API supporting:
 * - OpenAI (GPT-5-nano, gpt-image-1)
 * - Gemini (future)
 * - Grok (future)
 * - DeepSeek (future)
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

// Middleware
app.use(cors());
app.use(express.json({ limit: config.server.bodyLimit }));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
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

// Start server
const PORT = config.server.port;
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 AI API Gateway Started');
    console.log('═══════════════════════════════════════');
    console.log(`   Port: ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('');
    console.log('🌐 Frontend:');
    console.log(`   http://localhost:${PORT}`);
    console.log('');
    console.log('📡 API Endpoints:');
    console.log('   GET  /api              - API info & health');
    console.log('   GET  /api/providers    - List providers');
    console.log('   POST /api/message      - Chat completion');
    console.log('   POST /api/analyze-image - Image analysis');
    console.log('   POST /api/generate-image - Image generation');
    console.log('═══════════════════════════════════════');
    console.log('');
});

module.exports = app;
