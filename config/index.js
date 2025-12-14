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
            name: 'ChatGPT',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: process.env.OPENAI_API_KEY,
            endpoints: {
                responses: '/responses',  // New Responses API for GPT-5 models
                chat: '/chat/completions', // Legacy Chat Completions API
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
                { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Multimodal reasoning' }
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
                { id: 'grok-4-1-fast', displayName: 'Grok 4.1 Fast', description: '2M context window' }
            ],
            defaultModel: 'grok-4-1-fast',
            defaults: {
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


