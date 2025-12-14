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
                chat: 'gpt-4o-mini',
                vision: 'gpt-4o-mini',
                imageGeneration: 'dall-e-3'
            },
            // Models shown in UI dropdown
            availableModels: [
                { id: 'gpt-4o', displayName: 'GPT-4o', description: 'Most capable' },
                { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', description: 'Fast & efficient' },
                { id: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', description: 'High quality' }
            ],
            defaultModel: 'gpt-4o-mini',
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
                chat: 'gemini-2.0-flash-exp',
                vision: 'gemini-2.0-flash-exp'
            },
            availableModels: [
                { id: 'gemini-2.0-flash-exp', displayName: 'Gemini 2.0 Flash', description: 'Multimodal reasoning' }
            ],
            defaultModel: 'gemini-2.0-flash-exp',
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
                chat: 'grok-beta',
                vision: 'grok-beta'
            },
            availableModels: [
                { id: 'grok-beta', displayName: 'Grok Beta', description: '2M context window' }
            ],
            defaultModel: 'grok-beta',
            defaults: {
                maxTokens: 4096
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
