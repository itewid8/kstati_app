# HTTP API

Base URL: `http://localhost:3000` locally, the Serverless Container URL in the cloud. All bodies are JSON; the server accepts up to 2 MB per request.

## Authentication

Successful sign-in returns `{ token, me }`. The token is an HS256 JWT valid for 90 days. Send it as:

```
X-Kstati-Token: <token>
```

`Authorization: Bearer <token>` also works, but only locally: Yandex Serverless Containers intercepts `Authorization`. A missing or invalid token yields `401 { "error": "unauthorized" }`.

`me` (also returned by `GET /me` and `/sync`):

```json
{ "id": "…", "name": "Саша", "nick": "sasha", "gender": "m", "color": "blue", "avatar": "С",
  "email": "sasha@example.ru", "hasPassword": true, "vk": false }
```

## Errors

| Status | `error` | When |
|---|---|---|
| 400 | `bad_request` | body failed validation; `message` and `details` describe the first issues |
| 400 | `code_expired`, `code_wrong` | email code expired, used up (5 attempts) or wrong |
| 401 | `unauthorized`, `bad_credentials` | no/invalid token; wrong email or password |
| 400 | `bad_member` | group role change for a non-member or the owner |
| 403 | `not_member`, `forbidden` | not a member of the group; no right for a group operation |
| 404 | `bad_code` | unknown invite code (`group.join`) |
| 409 | `email_taken` | registration with an existing email |
| 429 | `rate_limited` | more than 120 requests per minute from one IP (except `/health`) |
| 429 | `too_many` | 10 failed logins for an email within 15 minutes |
| 429 | `daily_limit` | voice quota (`VOICE_DAILY_LIMIT`) used up for today, Moscow time |
| 502 | `upstream` | SpeechKit or YandexGPT failed; `service` is `stt` or `llm` |
| 503 | `vk_disabled` | VK ID not configured |
| 500 | `server` | unexpected error |

Error body: `{ "error": "<code>", "message": "<text for the user, in Russian>" }`.

## Service

### `GET /health`
No auth. `{ "ok": true, "model": "yandexgpt-lite/latest", "db": "ydb" }`.

## Accounts

### `POST /auth/email/code`
Send a 6-digit code (valid 15 minutes).

```json
{ "email": "sasha@example.ru", "purpose": "register" }   // or "reset"
```

→ `{ "ok": true }`. Locally without Postbox the response also has `devCode`. For `reset` the answer is the same whether or not the address exists. `register` with a taken address → `409 email_taken`.

### `POST /auth/register`
```json
{ "email": "sasha@example.ru", "code": "123456", "name": "Саша", "password": "at-least-8-chars" }
```
→ `{ token, me }`.

### `POST /auth/login`
`{ "email", "password" }` → `{ token, me }`.

### `POST /auth/reset`
`{ "email", "code", "password" }` → sets the new password and returns `{ token, me }`.

### `GET /me`
→ `me`.

### `POST /me/password`
`{ "old"?: "…", "password": "…" }` — `old` is required when a password already exists. → `{ ok: true }`.

### `DELETE /me`
Leaves all groups (the user's items there are removed), deletes wishes, ideas, preferences, unique keys and the user. → `{ ok: true }`.

### `GET /nick/check?nick=sasha`
→ `{ "status": "free" | "taken" | "same" | "invalid" }`. Rule: 3–20 characters, Latin or Cyrillic letters, digits, `_` and `.`.

### VK ID (hidden in the app)
1. `GET /auth/vk/start?redirect=kstati://auth&state=…&code_challenge=…&code_challenge_method=S256` → 302 to `id.vk.com`.
2. `GET /auth/vk/callback` (VK redirects here) → 302 to `kstati://auth?state=…&ticket=…` or `?error=…`.
3. `POST /auth/vk/finish` `{ "ticket", "code_verifier" }` → `{ token, me }`. The ticket is single-use and only valid with the verifier whose SHA-256 was sent in step 1.

## Data

### `POST /sync`
Body — revisions the phone already has:

```json
{ "groups": { "<groupId>": 12 }, "owners": { "<userId>": 4 }, "ideas": { "<userId>": "…" } }
```

Response:

| Field | Contents |
|---|---|
| `me` | the user |
| `groups` | all the user's groups; `inviteCode` is empty for non-admins |
| `users` | public profiles of people in those groups |
| `revs` | current `{ groups, owners }` revisions |
| `items` | `{ groupId: (Task \| WatchItem)[] }` only for groups whose revision changed |
| `wishes` | `{ userId: Wish[] }` only for changed owners |
| `prefs` | `{ reminders, overrides }` or `null` |
| `ideaRevs`, `notes` | idea revisions and `{ userId: { topics, ideas } }` for changed owners; others' topics only if opened to a shared group |

### `POST /ops`
Ordered batch of up to 200 operations; each is applied independently.

```json
{ "ops": [
  { "op": "task.put", "task": { "id": "t1", "groupId": "g1", "title": "Ужин у родителей",
    "date": "2026-10-10", "time": "19:00", "doneAt": null } },
  { "op": "wish.put", "wish": { "id": "w1", "title": "Наушники", "note": "", "link": "", "receivedAt": null } }
] }
```

→ `{ "results": [ { "ok": true }, { "ok": false, "error": "bad_request", "message": "…" } ] }`. Some operations return extra data (`group` for group operations, `me` for `profile`).

| Operation | Payload |
|---|---|
| `task.put` | `task`: `id, groupId, title, date, time, note?, doneAt, repeat?, doneDates?, skipDates?, reminders?, endDate?, endTime?, people?, parentId?` |
| `watch.put` | `watch`: `id, groupId, title, kind, genres[], origin, year, watchedAt` |
| `item.delete` | `groupId, id` |
| `wish.put` / `wish.delete` | `wish`: `id, title, note, link, receivedAt` / `id` |
| `topic.put` / `topic.delete` | `topic`: `id, title, groupIds[]` / `id` |
| `idea.put` / `idea.delete` | `idea`: `id, topicId, text` / `id` |
| `group.create` | `group`: `id, name, category` |
| `group.update` | `id, name?, category?` (owner/admin) |
| `group.join` / `group.leave` | `code` / `id` |
| `group.admin` | `id, userId, admin` (owner only) |
| `group.remove` | `id, userId` (owner, or admin removing a non-admin) |
| `prefs` | `reminders?: { enabled, timed[], allDay[] }`, `overrides?: { taskId: spec[] \| null }` |
| `profile` | `name?, nick?, gender?, color?` (palette key or `#rrggbb`), `avatar?` (≤16 chars) |

Formats: dates `YYYY-MM-DD`, times `HH:MM`, reminder specs `m90` (minutes before), `d1@20:00` (days before at time), `M1@20:00` (months before at time). `repeat`: `{ freq: day|week|month|year, every, weekdays?, monthDays?, months?, until?, count? }`. Categories: `couple`, `family`, `parents`, `friends`, `other`.

### `GET /activity?since=<id>`
What other members did in the user's groups and with shared wishes over the last 30 days (or since the given entry). → `{ "events": Activity[] }`, newest first.

## Voice

Both routes take the same metadata:

| Field | Meaning |
|---|---|
| `groupId` | current group (must be a member) |
| `today`, `now` | user's local date `YYYY-MM-DD` and time `HH:MM` |
| `topicId?` | open idea topic: an idea without a named topic goes there |
| `parentId?` | open plan: a new task becomes its sub-task |

### `POST /voice`
`audio`: base64 m4a (≤ ~1.1 MB decoded). Pipeline: ffmpeg → SpeechKit → YandexGPT → validation.

### `POST /voice/text`
`text`: 1–1000 characters — re-parse after the user edits the transcript.

Response for both:

```json
{ "transcript": "в субботу в семь ужин у родителей",
  "result": { "type": "items", "items": [
    { "key": "…", "type": "task", "data": { "title": "Ужин у родителей", "date": "2026-10-10", "time": "19:00", "note": "" } } ] },
  "left": 27 }
```

`left` is the remaining daily quota. `result.type` (see `server/src/types.ts`, `ParseResult`):

| `type` | Payload | App reaction |
|---|---|---|
| `items` | `items[]`: drafts of `task`, `wish`, `watch`, `idea`, `topic` | card to review and save |
| `changes` | `changes[]`: `{ action: update\|mark\|unmark\|delete, type, candidates[], chosen, patch? }` | “was → becomes” card; choice when several candidates match |
| `notFound` | `query` | “not found in your lists” |
| `queryWatch` | `filters` | opens Смотреть filtered |
| `queryWish` / `unknownPerson` | `personId` / `name` | opens that person's wishes / name not recognized |
| `queryPlans` | `plans`: whose and which period | the app selects groups and tasks (`mobile/src/lib/plans.ts`) |
| `queryIdeas` | `topicId` (`inbox`, an id, or `null`) | opens the topic |
| `unknown` | — | “not understood — add as task / wish / movie?” |

What the model is asked to return and which checks server code applies are described in [voice-api.md](voice-api.md).
