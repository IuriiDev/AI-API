require('dotenv').config();
const express = require('express');
const cors = require('cors');

const {
    handleChatMessage,
    handleImageAnalysis,
    handleImageGeneration
} = require('./controllers/openaiController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Health Check
app.get('/', (_, res) => {
    res.send('✅ OpenAI API is running');
});

// OpenAI Routes
app.post('/api/message', handleChatMessage);
app.post('/api/analyze-image', handleImageAnalysis);
app.post('/api/generate-image', handleImageGeneration);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 OpenAI API is running on port ${PORT}`);
    console.log(`📡 Available endpoints:`);
    console.log(`   POST /api/message`);
    console.log(`   POST /api/analyze-image`);
    console.log(`   POST /api/generate-image`);
});
