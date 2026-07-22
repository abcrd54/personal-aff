# 03 — API Reference

All endpoints except `/` and `/health` require auth via `x-api-key` header or `Authorization: Bearer <key>`.

## Endpoint Index

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | API documentation (JSON) |
| `GET` | `/health` | Health check (public) |
| `GET` | `/v1/models` | List personas as OpenAI models |
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat |
| `GET` | `/api/personas` | List all personas |
| `POST` | `/api/personas` | Create persona |
| `GET` | `/api/personas/:id` | Get persona by UUID |
| `PUT` | `/api/personas/:id` | Update persona |
| `DELETE` | `/api/personas/:id` | Delete persona |
| `GET` | `/api/sessions` | List sessions |
| `POST` | `/api/sessions` | Create session |
| `GET` | `/api/sessions/:id/messages` | Get session chat history |
| `DELETE` | `/api/sessions/:id` | Delete session |
| `POST` | `/api/chat` | Chat message (REST) |
| `WS` | `/api/chat/ws` | Chat message (WebSocket streaming) |
| `GET` | `/api/blueprints` | List persona templates |
| `POST` | `/api/ai/enhance-backstory` | AI-generate persona config |
| `POST` | `/api/content/generate-caption` | Generate social media caption |
| `POST` | `/api/content/generate-image-prompt` | Generate AI image prompt |

## Personas

### `POST /api/personas`

Body must be a valid `PersonaConfig`. See `02-personas.md` for full field reference.

**Response:** `201 Created` — Full persona object with generated UUID.

### `GET /api/personas`

List all personas ordered by newest first.

### `GET /api/personas/:id`

Get single persona by UUID. `404` if not found.

### `PUT /api/personas/:id`

Partial update. Merged with existing config. Invalidates prompt cache.

### `DELETE /api/personas/:id`

Delete persona. Cascades. Returns `{ "ok": true }`.

## Sessions

### `POST /api/sessions`

```json
{ "personaId": "uuid", "title": "Chat Title" }
```

### `GET /api/sessions`

Optional `?personaId=uuid` filter. Optional `?limit=50` (max 100).

### `GET /api/sessions/:id/messages`

Max 50 messages, ordered by time.

## Chat (Native)

### `POST /api/chat`

```json
{ "personaId": "uuid", "message": "text", "sessionId": "optional-uuid" }
```

**Response:** `{ "sessionId": "uuid", "reply": "..." }`

Auto-creates session if `sessionId` not provided. Session-locked to prevent concurrent interleaving.

### WebSocket `GET /api/chat/ws`

```
ws://host/api/chat/ws?personaId=uuid&sessionId=uuid&api_key=key
```

Send: `{ "message": "text" }`  
Receive: `{ "type": "chunk"|"done"|"error"|"ping", "content": "..." }`

Ping every 30s. One message at a time per WS connection.

## OpenAI-Compatible API

### `GET /v1/models`

```json
{ "object": "list", "data": [{ "id": "Maya", "object": "model", "created": 1700000000, "owned_by": "aff-personal" }] }
```

### `POST /v1/chat/completions`

```json
{ "model": "Maya", "messages": [{ "role": "user", "content": "..." }], "stream": false, "temperature": 0.8, "max_tokens": 2048 }
```

Persona lookup: UUID first → case-insensitive name. Multiple name matches → `400`.

**Streaming:** SSE (`text/event-stream`), chunks end with `data: [DONE]`.

**Note:** System messages in `messages` are overwritten with persona's system prompt.

## Content Generation

See `04-content-system.md` for detailed parameter reference.

### `POST /api/content/generate-caption`

```json
{ "personaId": "uuid", "topic": "...", "mode": "affiliate", "platform": "instagram", "count": 1 }
```

### `POST /api/content/generate-image-prompt`

```json
{ "personaId": "uuid", "productName": "...", "scene": "...", "mode": "affiliate", "engine": "midjourney", "count": 1 }
```

## Health

### `GET /health`

```json
{ "status": "ok", "uptime": 123.45, "db": "connected", "llm": "connected", "queue": { "running": 0, "queued": 0, "maxConcurrency": 3, "availableSlots": 3 }, "personas": 5, "timestamp": "..." }
```

## Error Responses

### Standard format
```json
{ "error": "message" }
```

### Validation errors
```json
{ "error": "Validation failed", "details": [{ "field": "name", "message": "Name is required" }] }
```

### OpenAI format (`/v1`)
```json
{ "error": { "message": "...", "type": "invalid_request_error" } }
```

### HTTP Status Codes

| Status | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad request |
| 401 | Unauthorized |
| 404 | Not found |
| 413 | Body too large (max 512KB) |
| 422 | Validation failed |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 502 | LLM service unavailable |
| 503 | Queue timeout |