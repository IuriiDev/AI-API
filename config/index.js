/**
 * Centralized Configuration
 * Single source of truth for all settings
 */

module.exports = {
    // Server
    server: {
        port: process.env.PORT || 3000,
        bodyLimit: '25mb'
    },

    // Rate Limiting
    rateLimiting: {
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000 // 15 minutes
    },

    // Request Validation
    validation: {
        maxInputLength: parseInt(process.env.MAX_INPUT_LENGTH) || 32000, // ~8k tokens
        minInputLength: 1
    },

    // Timeout Settings
    timeouts: {
        requestMs: parseInt(process.env.REQUEST_TIMEOUT_MS) || 30000, // 30 seconds
        retryAttempts: 3,
        retryDelayMs: 1000 // Initial delay, exponential backoff applied
    },

    // CORS Settings
    cors: {
        origins: process.env.CORS_ORIGINS
            ? process.env.CORS_ORIGINS.split(',')
            : ['http://localhost:3000', 'http://localhost:8080'],
        credentials: true
    },

    // Logging
    logging: {
        logUserContent: process.env.LOG_USER_CONTENT === 'true' // Default: false
    },

    // AI Providers Configuration
    providers: {
        openai: {
            name: 'ChatGPT',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: process.env.OPENAI_API_KEY,
            endpoints: {
                chat: '/chat/completions',
                imageGeneration: '/images/generations'
            },
            // Models used for API requests
            models: {
                chat: 'gpt-5-nano',
                vision: 'gpt-5-nano',
                imageGeneration: 'gpt-image-1'
            },
            // Models shown in UI dropdown
            availableModels: [
                { id: 'gpt-5.2', displayName: 'ChatGPT 5.2', description: 'Most capable' },
                { id: 'gpt-5-mini', displayName: 'ChatGPT 5 Mini', description: 'Balanced' },
                { id: 'gpt-5-nano', displayName: 'ChatGPT 5 Nano', description: 'Fast & efficient' }
            ],
            defaultModel: 'gpt-5-nano',
            defaults: {
                maxCompletionTokens: 4096
            }
        },

        gemini: {
            name: 'Gemini',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: process.env.GEMINI_API_KEY,
            endpoints: {
                chat: '/models/{model}:generateContent'
            },
            models: {
                chat: 'gemini-2.5-flash',
                vision: 'gemini-2.5-flash'
            },
            availableModels: [
                { id: 'gemini-3-pro-preview', displayName: 'Gemini 3 Pro (Preview)', description: 'Most capable multimodal' },
                { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'High-quality reasoning' },
                { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Fast multimodal reasoning' },
                { id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite', description: 'Lightweight, cost-efficient' }
            ],
            defaultModel: 'gemini-2.5-flash',
            defaults: {
                maxOutputTokens: 8192
            }
        },

        grok: {
            name: 'Grok',
            baseUrl: 'https://api.x.ai/v1',
            apiKey: process.env.GROK_API_KEY,
            endpoints: {
                chat: '/chat/completions'
            },
            models: {
                chat: 'grok-4-1-fast-non-reasoning',
                vision: 'grok-4-1-fast-non-reasoning'
            },
            availableModels: [
                { id: 'grok-4-1-fast-reasoning', displayName: 'Grok 4.1 Fast (Reasoning)', description: '2M context window' },
                { id: 'grok-4-1-fast-non-reasoning', displayName: 'Grok 4.1 Fast (Non-Reasoning)', description: '2M context window' },
                { id: 'grok-4-1', displayName: 'Grok 4.1', description: '2M context window' },
                { id: 'grok-4-fast-reasoning', displayName: 'Grok 4 Fast (Reasoning)', description: '512k context window' },
                { id: 'grok-4-fast-non-reasoning', displayName: 'Grok 4 Fast (Non-Reasoning)', description: '512k context window' }
            ],
            defaultModel: 'grok-4-1-fast-non-reasoning',
            defaults: {
                maxTokens: 4096
            }
        },

        deepseek: {
            name: 'DeepSeek',
            baseUrl: 'https://api.deepseek.com/v1',
            apiKey: process.env.DEEPSEEK_API_KEY,
            endpoints: {
                chat: '/chat/completions'
            },
            models: {
                chat: 'deepseek-chat'
            },
            availableModels: [
                { id: 'deepseek-chat', displayName: 'DeepSeek Chat', description: 'General-purpose conversational model' },
                { id: 'deepseek-reasoner', displayName: 'DeepSeek Reasoner', description: 'Enhanced reasoning capabilities' }
            ],
            defaultModel: 'deepseek-chat',
            defaults: {
                maxTokens: 8192
            }
        }
    },

    // Image Generation Settings
    imageSettings: {
        sizes: ['1024x1024', '1536x1024', '1024x1536'],
        qualities: ['standard', 'hd'],
        formats: ['png', 'jpeg', 'webp'],
        defaults: {
            size: '1024x1024',
            quality: 'standard',
            format: 'png',
            count: 1
        }
    }
};
