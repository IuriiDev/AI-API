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
            baseUrl: 'https://api.openai.com/v1',
            apiKey: process.env.OPENAI_API_KEY,
            endpoints: {
                chat: '/chat/completions',
                imageGeneration: '/images/generations'
            },
            models: {
                vision: 'gpt-5-nano',
                imageGeneration: 'gpt-image-1'
            },
            defaults: {
                maxCompletionTokens: 4096
            }
        },
        
        // Future providers - just add configuration here
        gemini: {
            name: 'Gemini',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            apiKey: process.env.GEMINI_API_KEY,
            endpoints: {
                chat: '/models/gemini-pro:generateContent'
            },
            models: {
                vision: 'gemini-pro-vision'
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
                vision: 'grok-vision-beta'
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
                vision: 'deepseek-vl'
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

