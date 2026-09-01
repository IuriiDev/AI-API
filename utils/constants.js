// OpenAI API Configuration

// API Endpoints
const ENDPOINTS = {
    CHAT_COMPLETIONS: 'https://api.openai.com/v1/chat/completions',
    IMAGE_GENERATIONS: 'https://api.openai.com/v1/images/generations'
};

// Models
const MODELS = {
    // Vision + Chat
    GPT_5_6: 'gpt-5.6',
    GPT_5_6_SOL: 'gpt-5.6-sol',
    GPT_5_6_TERRA: 'gpt-5.6-terra',
    GPT_5_6_LUNA: 'gpt-5.6-luna',
    GPT_5_4_MINI: 'gpt-5.4-mini',
    
    // Image Generation
    GPT_IMAGE_2: 'gpt-image-2'
};

// Token Limits (use max_completion_tokens for latest API)
const TOKEN_LIMITS = {
    GPT_5_6_CONTEXT: 1050000,
    GPT_5_6_MAX_COMPLETION: 128000,
    GPT_5_4_MINI_CONTEXT: 400000,
    GPT_5_4_MINI_MAX_COMPLETION: 128000,
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
        QUALITY: 'medium',
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
