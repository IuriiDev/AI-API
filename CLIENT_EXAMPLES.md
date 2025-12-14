# AI API Gateway - Client Examples

All client applications must communicate with the backend only. **Never expose API keys in client code.**

## API Base URL

```
https://ai-api.okonrentner.com/api
```

---

## Chat - POST /ai/respond

The unified chat endpoint supports multiple input formats and modes.

### Simple Input (New Apps)

```bash
curl -X POST https://ai-api.okonrentner.com/api/ai/respond \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Explain quantum computing",
    "model": "gpt-5-nano"
  }'
```

### Messages Array (iOS App Compatible)

```bash
curl -X POST https://ai-api.okonrentner.com/api/ai/respond \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello"},
      {"role": "assistant", "content": "Hi! How can I help?"},
      {"role": "user", "content": "Tell me about AI"}
    ],
    "provider": "openai"
  }'
```

### With Image (Vision)

```bash
curl -X POST https://ai-api.okonrentner.com/api/ai/respond \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What is in this image?"}],
    "image": "<base64-encoded-image>",
    "provider": "openai"
  }'
```

### Response

```json
{
  "success": true,
  "text": "AI response here...",
  "content": "AI response here...",
  "id": "chatcmpl-...",
  "model": "gpt-5-nano",
  "provider": "ChatGPT",
  "usage": { "prompt_tokens": 10, "completion_tokens": 150 }
}
```

---

## Streaming - POST /ai/respond

```bash
curl -X POST https://ai-api.okonrentner.com/api/ai/respond \
  -H "Content-Type: application/json" \
  -d '{"input": "Tell me a story", "stream": true}'
```

**Response (SSE):**
```
data: {"text":"Once"}
data: {"text":" upon"}
data: {"text":" a time..."}
data: {"done":true}
```

### JavaScript Example

```javascript
async function streamChat(input, onChunk) {
  const response = await fetch('https://ai-api.okonrentner.com/api/ai/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, stream: true })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const json = JSON.parse(line.slice(6));
        if (json.text) onChunk(json.text);
        if (json.done) return;
      }
    }
  }
}
```

---

## Background Jobs - POST /ai/respond

### Start Job

```bash
curl -X POST https://ai-api.okonrentner.com/api/ai/respond \
  -H "Content-Type: application/json" \
  -d '{"input": "Write an essay", "background": true}'
```

**Response:**
```json
{
  "success": true,
  "job_id": "job_abc123def456",
  "status": "queued"
}
```

### Poll Job - GET /ai/jobs/:job_id

```bash
curl https://ai-api.okonrentner.com/api/ai/jobs/job_abc123def456
```

**Response:**
```json
{
  "success": true,
  "job_id": "job_abc123def456",
  "status": "completed",
  "text": "Here is your essay..."
}
```

Status values: `queued`, `running`, `completed`, `failed`

---

## Swift Example (iOS)

```swift
struct AIRequest: Codable {
    let messages: [[String: String]]
    let provider: String?
    let image: String?
}

struct AIResponse: Codable {
    let success: Bool
    let content: String?
    let text: String?
}

func sendMessage(messages: [[String: String]], provider: String = "openai", image: String? = nil) async throws -> String {
    let url = URL(string: "https://ai-api.okonrentner.com/api/ai/respond")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body = AIRequest(messages: messages, provider: provider, image: image)
    request.httpBody = try JSONEncoder().encode(body)
    
    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(AIResponse.self, from: data)
    
    return response.content ?? response.text ?? ""
}
```

---

## Error Handling

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human-readable description"
}
```

| Code | Meaning |
|------|---------|
| 400  | Bad Request |
| 404  | Not Found |
| 429  | Rate Limit (check `Retry-After` header) |
| 500  | Server Error |
