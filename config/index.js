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

    // AI Providers Configuration
    providers: {
        openai: {
            name: 'OpenAI',
            displayName: 'GPT-5 Nano',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: process.env.OPENAI_API_KEY,
            endpoints: {
                chat: '/chat/completions',
                imageGeneration: '/images/generations'
            },
            models: {
                chat: 'gpt-5-nano',
                vision: 'gpt-5-nano',
                imageGeneration: 'gpt-image-1'
            },
            defaults: {
                maxCompletionTokens: 4096
            }
        },
        
        gemini: {
            name: 'Gemini',
            displayName: 'Gemini 2.5 Flash',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: process.env.GEMINI_API_KEY,
            endpoints: {
                // Gemini uses model name in URL path
                chat: '/models/gemini-2.5-flash:generateContent'
            },
            models: {
                chat: 'gemini-2.5-flash',
                vision: 'gemini-2.5-flash'
            },
            defaults: {
                // Gemini uses maxOutputTokens in generationConfig
                maxOutputTokens: 8192
            }
        },
        
        grok: {
            name: 'Grok',
            displayName: 'Grok 4.1 Fast',
            baseUrl: 'https://api.x.ai/v1',
            apiKey: process.env.GROK_API_KEY,
            endpoints: {
                // OpenAI-compatible endpoint
                chat: '/chat/completions'
            },
            models: {
                // Best value: 2M context, $0.20/$0.50 per 1M tokens, supports vision
                chat: 'grok-4-1-fast-non-reasoning',
                vision: 'grok-4-1-fast-non-reasoning'
            },
            defaults: {
                // xAI uses max_tokens (not max_completion_tokens)
                maxTokens: 4096
            }
        }
    },

    // Image Generation Settings
    imageSettings: {
        sizes: ['1024x1024', '1536x1024', '1024x1536'],
        qualities: ['auto', 'low', 'medium', 'high'],
        formats: ['png', 'jpeg', 'webp'],
        defaults: {
            size: '1024x1024',
            quality: 'auto',
            format: 'png',
            count: 1
        }
    }
};
