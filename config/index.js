function positiveInteger(value, fallback) {
    const parsedValue = Number.parseInt(value, 10);
    return Number.isInteger(parsedValue) && parsedValue > 0
        ? parsedValue
        : fallback;
}

const commonDocumentFormats = [
    'pdf', 'txt', 'md', 'json', 'html', 'xml', 'csv', 'tsv',
    'rtf', 'doc', 'docx', 'odt', 'ppt', 'pptx', 'xls', 'xlsx'
];

module.exports = {
    server: {
        port: positiveInteger(process.env.PORT, 3000),
        bodyLimit: process.env.BODY_LIMIT || '25mb',
        trustProxy: positiveInteger(process.env.TRUST_PROXY_HOPS, 1)
    },

    rateLimiting: {
        maxRequests: positiveInteger(process.env.RATE_LIMIT_MAX, 100),
        windowMs: positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000)
    },

    validation: {
        maxInputLength: positiveInteger(process.env.MAX_INPUT_LENGTH, 32000),
        minInputLength: 1
    },

    documentAnalysis: {
        appAuthToken: process.env.DOCUMENT_ANALYSIS_APP_TOKEN || '',
        defaultProvider: (process.env.DOCUMENT_ANALYSIS_PROVIDER || 'grok').toLowerCase(),
        maximumFileSizeBytes: positiveInteger(
            process.env.DOCUMENT_MAX_FILE_SIZE_BYTES,
            10 * 1024 * 1024
        ),
        maximumDocumentCount: positiveInteger(process.env.DOCUMENT_MAX_FILE_COUNT, 5),
        maximumTotalFileSizeBytes: positiveInteger(
            process.env.DOCUMENT_MAX_TOTAL_FILE_SIZE_BYTES,
            45 * 1024 * 1024
        ),
        maximumPromptLength: positiveInteger(process.env.DOCUMENT_MAX_PROMPT_LENGTH, 32000),
        maximumSchemaLength: positiveInteger(process.env.DOCUMENT_MAX_SCHEMA_LENGTH, 64000),
        uploadedFileLifetimeSeconds: positiveInteger(
            process.env.DOCUMENT_FILE_LIFETIME_SECONDS,
            3600
        ),
        requestTimeoutMs: positiveInteger(process.env.DOCUMENT_ANALYSIS_TIMEOUT_MS, 120000)
    },

    timeouts: {
        requestMs: positiveInteger(process.env.REQUEST_TIMEOUT_MS, 30000),
        retryAttempts: positiveInteger(process.env.RETRY_ATTEMPTS, 3),
        retryDelayMs: positiveInteger(process.env.RETRY_DELAY_MS, 1000)
    },

    cors: {
        origins: process.env.CORS_ORIGINS
            ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
            : ['http://localhost:3000', 'http://localhost:8080'],
        credentials: true
    },

    logging: {
        logUserContent: process.env.LOG_USER_CONTENT === 'true'
    },

    providers: {
        openai: {
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: process.env.OPENAI_API_KEY,
            endpoints: {
                chat: '/chat/completions',
                files: '/files',
                responses: '/responses',
                imageGeneration: '/images/generations'
            },
            models: {
                chat: 'gpt-5.4-mini',
                vision: 'gpt-5.4-mini',
                documentAnalysis: process.env.OPENAI_DOCUMENT_MODEL || 'gpt-5.5',
                imageGeneration: 'gpt-image-2'
            },
            availableModels: [
                { id: 'gpt-5.5', displayName: 'GPT-5.5', description: 'Flagship reasoning model' },
                { id: 'gpt-5.4', displayName: 'GPT-5.4', description: 'High-capability general model' },
                { id: 'gpt-5.4-mini', displayName: 'GPT-5.4 Mini', description: 'Balanced speed and quality' },
                { id: 'gpt-5.4-nano', displayName: 'GPT-5.4 Nano', description: 'Low-latency workloads' },
                { id: 'gpt-5', displayName: 'GPT-5', description: 'Legacy flagship model', status: 'legacy' },
                { id: 'gpt-5-nano', displayName: 'GPT-5 Nano', description: 'Legacy low-latency model', status: 'legacy' }
            ],
            defaultModel: 'gpt-5.4-mini',
            documentInput: {
                supportedByProvider: true,
                gatewayEnabled: true,
                models: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'],
                formats: commonDocumentFormats,
                notes: 'PDF content includes extracted text and page images; other documents are text-extracted.'
            },
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
                chat: 'gemini-3.5-flash',
                vision: 'gemini-3.5-flash'
            },
            availableModels: [
                { id: 'gemini-3.5-flash', displayName: 'Gemini 3.5 Flash', description: 'Stable multimodal model' },
                { id: 'gemini-3.1-pro-preview', displayName: 'Gemini 3.1 Pro (Preview)', description: 'Advanced reasoning model' },
                { id: 'gemini-3.1-flash-lite', displayName: 'Gemini 3.1 Flash-Lite', description: 'Stable cost-efficient model' },
                { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'Previous stable reasoning model' },
                { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Previous stable multimodal model' },
                { id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite', description: 'Previous cost-efficient model', status: 'legacy' },
                { id: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash (Preview)', description: 'Retired preview retained for compatibility metadata', status: 'retired', selectable: false },
                { id: 'gemini-3.1-flash-lite-preview', displayName: 'Gemini 3.1 Flash-Lite (Preview)', description: 'Retired preview retained for compatibility metadata', status: 'retired', selectable: false }
            ],
            defaultModel: 'gemini-3.5-flash',
            documentInput: {
                supportedByProvider: true,
                gatewayEnabled: false,
                models: ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'],
                formats: commonDocumentFormats,
                notes: 'PDF is processed natively; non-PDF documents are primarily text-extracted.'
            },
            defaults: {
                maxOutputTokens: 8192
            }
        },

        grok: {
            name: 'xAI',
            baseUrl: 'https://api.x.ai/v1',
            apiKey: process.env.XAI_API_KEY || process.env.GROK_API_KEY,
            endpoints: {
                chat: '/chat/completions',
                files: '/files',
                responses: '/responses'
            },
            models: {
                chat: 'grok-4.3',
                vision: 'grok-4.3',
                documentAnalysis: process.env.XAI_DOCUMENT_MODEL || 'grok-4.3'
            },
            availableModels: [
                { id: 'grok-4.3', displayName: 'Grok 4.3', description: 'Recommended general agentic model' },
                { id: 'grok-4.20-0309-reasoning', displayName: 'Grok 4.20 0309 Reasoning', description: 'Reasoning snapshot' },
                { id: 'grok-4.20-0309-non-reasoning', displayName: 'Grok 4.20 0309 Non-Reasoning', description: 'Low-latency snapshot' },
                { id: 'grok-4.20-multi-agent-0309', displayName: 'Grok 4.20 Multi-Agent 0309', description: 'Multi-agent research snapshot' },
                { id: 'grok-4-1-fast-reasoning', displayName: 'Grok 4.1 Fast Reasoning', description: 'Retired model retained for compatibility metadata', status: 'retired', selectable: false },
                { id: 'grok-4-1-fast-non-reasoning', displayName: 'Grok 4.1 Fast Non-Reasoning', description: 'Retired model retained for compatibility metadata', status: 'retired', selectable: false },
                { id: 'grok-4-1', displayName: 'Grok 4.1', description: 'Retired model retained for compatibility metadata', status: 'retired', selectable: false },
                { id: 'grok-4-fast-reasoning', displayName: 'Grok 4 Fast Reasoning', description: 'Retired model retained for compatibility metadata', status: 'retired', selectable: false },
                { id: 'grok-4-fast-non-reasoning', displayName: 'Grok 4 Fast Non-Reasoning', description: 'Retired model retained for compatibility metadata', status: 'retired', selectable: false }
            ],
            defaultModel: 'grok-4.3',
            documentInput: {
                supportedByProvider: true,
                gatewayEnabled: true,
                models: [
                    'grok-4.3',
                    'grok-4.20-0309-reasoning',
                    'grok-4.20-0309-non-reasoning',
                    'grok-4.20-multi-agent-0309'
                ],
                formats: commonDocumentFormats,
                notes: 'Supports PDF and common text-based document formats through the Files API.'
            },
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
                chat: 'deepseek-v4-flash'
            },
            availableModels: [
                { id: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', description: 'Fast 1M-context model' },
                { id: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro', description: 'Higher-capability 1M-context model' },
                { id: 'deepseek-chat', displayName: 'DeepSeek Chat', description: 'Deprecated compatibility alias', status: 'legacy' },
                { id: 'deepseek-reasoner', displayName: 'DeepSeek Reasoner', description: 'Deprecated compatibility alias', status: 'legacy' }
            ],
            defaultModel: 'deepseek-v4-flash',
            documentInput: {
                supportedByProvider: false,
                gatewayEnabled: false,
                models: [],
                formats: [],
                notes: 'No public direct document-input API is currently documented.'
            },
            defaults: {
                maxTokens: 8192
            }
        }
    },

    imageSettings: {
        sizes: ['1024x1024', '1536x1024', '1024x1536'],
        qualities: ['low', 'medium', 'high'],
        formats: ['png', 'jpeg', 'webp'],
        maximumCount: 4,
        defaults: {
            size: '1024x1024',
            quality: 'medium',
            format: 'png',
            count: 1
        }
    }
};
