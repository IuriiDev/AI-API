// OpenAI API Configuration

// API Endpoints
const ENDPOINTS = {
    CHAT_COMPLETIONS: 'https://api.openai.com/v1/chat/completions',
    IMAGE_GENERATIONS: 'https://api.openai.com/v1/images/generations'
};

// Models
const MODELS = {
    // Vision + Chat
    GPT_5_NANO: 'gpt-5-nano',           // 400K context, 128K output
    
    // Image Generation
    GPT_IMAGE_1: 'gpt-image-1'          // Latest image generation model
};

// Token Limits
const TOKEN_LIMITS = {
    GPT_5_NANO_CONTEXT: 400000,
    GPT_5_NANO_MAX_OUTPUT: 128000,
    DEFAULT_MAX_OUTPUT: 4096
};

// Image Generation Settings
const IMAGE_SETTINGS = {
    SIZES: {
        SQUARE_SM: '1024x1024',
        LANDSCAPE: '1536x1024',
        PORTRAIT: '1024x1536'
    },
    QUALITY: {
        AUTO: 'auto',
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high'
    },
    FORMAT: {
        PNG: 'png',
        JPEG: 'jpeg',
        WEBP: 'webp'
    },
    DEFAULTS: {
        SIZE: '1024x1024',
        QUALITY: 'auto',
        FORMAT: 'png',
        COUNT: 1
    }
};

// Request Headers
const headers = {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
};

module.exports = {
    ENDPOINTS,
    MODELS,
    TOKEN_LIMITS,
    IMAGE_SETTINGS,
    headers
};
