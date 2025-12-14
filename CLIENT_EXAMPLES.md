# AI API Gateway - Client Examples

All client applications must communicate with the backend only. **Never expose API keys in client code.**

## Base URL

```
http://localhost:3000/api
```

---

## Standard (Synchronous) Request

### curl

```bash
curl -X POST http://localhost:3000/api/ai/respond \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Explain quantum computing in simple terms",
    "model": "gpt-4o-mini"
  }'
```

**Response:**
```json
{
  "success": true,
  "text": "Quantum computing uses quantum bits...",
  "id": "chatcmpl-...",
  "model": "gpt-4o-mini",
  "usage": { "prompt_tokens": 10, "completion_tokens": 150 }
}
```

### JavaScript (fetch)

```javascript
async function sendMessage(input) {
  const response = await fetch('http://localhost:3000/api/ai/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input })
  });
  
  const data = await response.json();
  return data.text;
}

// Usage
const reply = await sendMessage('Hello, how are you?');
console.log(reply);
```

### Swift (URLSession)

```swift
struct AIRequest: Codable {
    let input: String
    let model: String?
    let stream: Bool?
    let background: Bool?
}

struct AIResponse: Codable {
    let success: Bool
    let text: String?
    let id: String?
}

func sendMessage(_ input: String) async throws -> String {
    let url = URL(string: "http://localhost:3000/api/ai/respond")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body = AIRequest(input: input, model: nil, stream: false, background: false)
    request.httpBody = try JSONEncoder().encode(body)
    
    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(AIResponse.self, from: data)
    
    return response.text ?? ""
}
```

---

## Streaming Request (SSE)

### curl

```bash
curl -X POST http://localhost:3000/api/ai/respond \
  -H "Content-Type: application/json" \
  -d '{"input": "Tell me a short story", "stream": true}'
```

**Response (SSE):**
```
data: {"text":"Once"}

data: {"text":" upon"}

data: {"text":" a"}

data: {"text":" time..."}

data: {"done":true}
```

### JavaScript (EventSource-like)

```javascript
async function streamMessage(input, onChunk) {
  const response = await fetch('http://localhost:3000/api/ai/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, stream: true })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const json = JSON.parse(line.slice(6));
        if (json.text) {
          fullText += json.text;
          onChunk(json.text);
        }
        if (json.done) {
          return fullText;
        }
      }
    }
  }
  return fullText;
}

// Usage
await streamMessage('Tell me a story', (chunk) => {
  process.stdout.write(chunk); // Print incrementally
});
```

### Swift (URLSession with streaming)

```swift
func streamMessage(_ input: String, onChunk: @escaping (String) -> Void) async throws {
    let url = URL(string: "http://localhost:3000/api/ai/respond")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body = AIRequest(input: input, model: nil, stream: true, background: false)
    request.httpBody = try JSONEncoder().encode(body)
    
    let (bytes, _) = try await URLSession.shared.bytes(for: request)
    
    for try await line in bytes.lines {
        if line.hasPrefix("data: ") {
            let jsonString = String(line.dropFirst(6))
            if let data = jsonString.data(using: .utf8),
               let json = try? JSONDecoder().decode([String: String].self, from: data),
               let text = json["text"] {
                onChunk(text)
            }
        }
    }
}
```

---

## Background Job (Long-Running Tasks)

### Step 1: Start the job

```bash
curl -X POST http://localhost:3000/api/ai/respond \
  -H "Content-Type: application/json" \
  -d '{"input": "Write a detailed essay about AI ethics", "background": true}'
```

**Response:**
```json
{
  "success": true,
  "job_id": "job_abc123def456",
  "status": "queued"
}
```

### Step 2: Poll for completion

```bash
curl http://localhost:3000/api/ai/jobs/job_abc123def456
```

**Response (running):**
```json
{
  "success": true,
  "job_id": "job_abc123def456",
  "status": "running"
}
```

**Response (completed):**
```json
{
  "success": true,
  "job_id": "job_abc123def456",
  "status": "completed",
  "text": "AI ethics encompasses several key principles..."
}
```

### JavaScript (polling loop)

```javascript
async function runBackgroundJob(input) {
  // Start job
  const startResponse = await fetch('http://localhost:3000/api/ai/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, background: true })
  });
  const { job_id } = await startResponse.json();
  console.log(`Job started: ${job_id}`);

  // Poll until complete
  while (true) {
    await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
    
    const statusResponse = await fetch(`http://localhost:3000/api/ai/jobs/${job_id}`);
    const status = await statusResponse.json();
    
    console.log(`Status: ${status.status}`);
    
    if (status.status === 'completed') {
      return status.text;
    }
    if (status.status === 'failed') {
      throw new Error(status.error);
    }
  }
}

// Usage
const result = await runBackgroundJob('Write a long essay');
console.log(result);
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Human-readable error description"
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 400  | Bad Request (invalid input) |
| 404  | Not Found (invalid endpoint or job ID) |
| 429  | Rate Limit Exceeded |
| 500  | Server Error |

### Rate Limit Response

```json
{
  "success": false,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "retryAfter": 45
}
```

Check `Retry-After` header for seconds until reset.
