# Provider Capabilities

Verified against official provider documentation on 2026-06-19.

| Provider | Current configured models | Direct document input | Gateway document strategy |
| --- | --- | --- | --- |
| OpenAI | GPT-5.5, GPT-5.4, GPT-5.4 Mini, GPT-5.4 Nano | PDF, text/code, rich documents, presentations, and spreadsheets | Enabled |
| Google Gemini | Gemini 3.5 Flash, Gemini 3.1 Pro Preview, Gemini 3.1 Flash-Lite | Native PDF understanding; non-PDF documents are primarily text-extracted | Not implemented |
| xAI | Grok 4.3 and Grok 4.20 variants | PDF and common text-based documents through the Files API | Enabled |
| DeepSeek | DeepSeek V4 Flash and DeepSeek V4 Pro | No public direct document-input endpoint is documented | Not available |

The `/api/document-analysis` contract is provider-neutral. Adding another strategy
requires a provider implementation and registration in `providers/documentProviders.js`;
clients do not need a product-specific backend route.

Older model identifiers remain in each provider's `availableModels` catalog.
Models retired by their provider are marked `selectable: false`; active legacy
aliases remain selectable for backward compatibility.

## Official References

- OpenAI models: https://developers.openai.com/api/docs/models
- OpenAI file inputs: https://developers.openai.com/api/docs/guides/file-inputs
- Gemini models: https://ai.google.dev/gemini-api/docs/models
- Gemini document processing: https://ai.google.dev/gemini-api/docs/document-processing
- xAI models: https://docs.x.ai/developers/models
- xAI files: https://docs.x.ai/developers/files
- DeepSeek models and pricing: https://api-docs.deepseek.com/quick_start/pricing
