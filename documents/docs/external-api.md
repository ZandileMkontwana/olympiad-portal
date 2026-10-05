---
sidebar_position: 10
---

# External API

The Olympiad Portal provides external APIs for accessing olympiad data programmatically. There are two types of access:

1. **Public API** — No authentication required, open for anyone to use
2. **Extended API** — Requires an API key for additional endpoints

## Public API (No Authentication)

The public API is open and free to use. No API key, no sign-up, no restrictions.

### Base URL

```
https://olympiad-portal-backend.onrender.com/api
```

### List Olympiads

```
GET /api/olympiads
```

Returns all olympiads with their rounds. Open to everyone — no authentication required.

**Example:**
```bash
curl https://olympiad-portal-backend.onrender.com/api/olympiads
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Mathematics Olympiad 2025",
    "timezone": "Africa/Johannesburg",
    "description": "Annual mathematics competition",
    "grades": "Grade 8-12",
    "startDate": "2025-03-01T00:00:00.000Z",
    "endDate": "2025-11-30T00:00:00.000Z",
    "rounds": [
      {
        "id": "uuid",
        "name": "Round 1",
        "openTime": "2025-03-15T08:00:00.000Z",
        "closeTime": "2025-03-22T17:00:00.000Z",
        "state": "open",
        "qualifyingThreshold": 60.0
      }
    ]
  }
]
```

**Fields:**

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | Olympiad name |
| `timezone` | Timezone (IANA format) |
| `description` | Organiser-written description |
| `grades` | Target learner grades |
| `startDate` | Olympiad start date |
| `endDate` | Olympiad end date |
| `rounds` | Array of rounds (see below) |

**Round fields:**

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | Round name |
| `openTime` | When the round opens |
| `closeTime` | When the round closes |
| `state` | Current state: `scheduled`, `open`, `closed`, or `results_released` |
| `qualifyingThreshold` | Minimum score % to advance (null if none) |

---

## Extended API (API Key Required)

For additional endpoints with controlled access, an API key is required.

### Base URL

```
https://olympiad-portal-backend.onrender.com/api/external
```

### Authentication

Pass your API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: olymp_your_api_key_here" \
  https://olympiad-portal-backend.onrender.com/api/external/rounds/ROUND_ID/results
```

### Obtaining an API Key

API keys are managed by organisers through the internal API:

- **Create a key:** `POST /api/api-keys` with body `{ "name": "Partner Name" }`
- **List keys:** `GET /api/api-keys`
- **Revoke a key:** `DELETE /api/api-keys/:id`

When a key is created, the full key value is returned **only once**. Store it securely — it cannot be retrieved later.

### Rate Limits

- **100 requests per 15 minutes** per API key
- Rate limit headers are included in every response:
  - `RateLimit-Limit` — maximum requests allowed in the window
  - `RateLimit-Remaining` — requests remaining in the current window
  - `RateLimit-Reset` — time when the window resets (UTC epoch seconds)

When rate limited, the API returns `429 Too Many Requests`.

### Endpoints

#### Get Round Results

```
GET /external/rounds/:id/results
```

Returns published results for a round. **Only available when the round state is `results_released`.**

**Response:**
```json
{
  "roundId": "uuid",
  "roundName": "Round 1",
  "olympiadName": "Mathematics Olympiad 2025",
  "results": [
    {
      "entrantName": "Alice Smith",
      "entrantGrade": "Grade 10",
      "schoolName": "Riverside High",
      "score": 92.5,
      "submittedAt": "2025-03-18T14:30:00.000Z",
      "releasedAt": "2025-03-25T10:00:00.000Z"
    }
  ]
}
```

#### List Schools

```
GET /external/schools
```

Returns all registered schools.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Riverside High",
    "timezone": "Africa/Johannesburg"
  }
]
```

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 401 | Missing or invalid API key (extended API only) |
| 403 | API key revoked, or results not yet released |
| 404 | Resource not found |
| 429 | Rate limit exceeded (extended API only) |
| 500 | Internal server error |

**Error response format:**
```json
{
  "error": "Description of what went wrong"
}
```

## Examples

### Public API — List all olympiads
```bash
curl https://olympiad-portal-backend.onrender.com/api/olympiads
```

### Extended API — Get results for a round
```bash
curl -H "X-API-Key: olymp_abc123..." \
  https://olympiad-portal-backend.onrender.com/api/external/rounds/ROUND_ID/results
```

### JavaScript (fetch)
```javascript
// Public API — no auth needed
const response = await fetch('https://olympiad-portal-backend.onrender.com/api/olympiads');
const olympiads = await response.json();
console.log(olympiads);
```

### Python
```python
import requests

# Public API — no auth needed
response = requests.get('https://olympiad-portal-backend.onrender.com/api/olympiads')
olympiads = response.json()
print(olympiads)
```

## Notes

- All timestamps are in UTC (ISO 8601 format)
- The public API is **read-only** — no write operations are available
- Results are only accessible after the organiser releases them (extended API)
- API keys can be revoked at any time by organisers
