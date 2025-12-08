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
            displayName: 'Gemini 2.0 Flash',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: process.env.GEMINI_API_KEY,
            endpoints: {
                chat: '/models/gemini-2.0-flash:generateContent'
            },
            models: {
                chat: 'gemini-2.0-flash',
                vision: 'gemini-2.0-flash'
            },
            defaults: {
                maxCompletionTokens: 4096
            }
        },
        
        grok: {
            name: 'Grok',
            displayName: 'Grok Beta',
            baseUrl: 'https://api.x.ai/v1',
            apiKey: process.env.GROK_API_KEY,
            endpoints: {
                chat: '/chat/completions'
            },
            models: {
                chat: 'grok-beta',
                vision: 'grok-vision-beta'
            },
            defaults: {
                maxCompletionTokens: 4096
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
