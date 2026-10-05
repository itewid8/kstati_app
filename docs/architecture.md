# Architecture

Two deployables: an Expo app (`mobile/`) and a Fastify API (`server/`). The phone is offline-first and owns the user's own edits; the server owns permissions, shared state and everything that talks to Yandex AI.

```
┌──────────────────────── phone ───────────────────────┐        ┌──────────────── Yandex Cloud ────────────────┐
│ screens (Expo Router)                                │        │ Serverless Container: Fastify (server/src)  │
│   └─ Zustand store ── persisted to kstati-state.json │        │   /auth/*  /sync  /ops  /activity  /voice   │
│        ├─ outbox of ops ──────────── POST /ops ──────┼──────► │        │                │                    │
│        └─ revs ────────────────────── POST /sync ────┼──────► │   Store interface ── YdbStore (Document API) │
│ VoiceRecorder (m4a) ──────────────── POST /voice ────┼──────► │   ffmpeg → SpeechKit → YandexGPT → parse.ts │
│ local notifications, background task, widgets       │        │   Lockbox (secrets) · Postbox (email codes) │
└──────────────────────────────────────────────────────┘        └──────────────────────────────────────────────┘
```

## Components

### Mobile app

| Part | Responsibility |
|---|---|
| `app/` | Screens. Root `_layout.tsx` loads fonts, applies the theme, starts sync and hosts the global pull-to-refresh indicator. Tabs: Дела, Хочу, Смотреть, Идеи; plus login, onboarding, group settings, activity feed, profile and reminder settings, `record` (deep link `kstati://record` from the widget) |
| `src/lib/store.ts` | Single Zustand store: session, groups, people, tasks, watch items, wishes, idea topics and ideas, reminder settings, UI preferences, outbox and sync revisions. Persisted through `storage.ts` to a JSON file in the app's documents folder (synchronous read on start, writes debounced by 0.4 s) |
| `src/lib/sync.ts` | Diffs task/watch/wish lists before and after every store change and turns the difference into operations; group and profile actions enqueue operations explicitly. Pushes the outbox in batches of 100, then pulls with `/sync`. Runs on launch, on return to foreground, every 15 s while active and 0.4 s after an edit; failures back off up to 60 s |
| `src/lib/voice.ts`, `components/VoiceRecorder.tsx`, `lib/api.ts` | Recording (AAC/m4a, mono, 16 kHz, 0.7–10 s), upload to `/voice`, re-parse of edited text through `/voice/text`, error classification (offline / server / daily limit) |
| `components/CardSheet.tsx`, `editors.tsx` | Confirmation card for a parse result: add, update (“was → becomes”), mark, unmark, delete, or “not understood — add as…” |
| `lib/plans.ts` | Answers “what are our plans…”: the model only says *whose* and *which period*; this code picks groups and tasks |
| `lib/recur.ts`, `span.ts`, `dates.ts`, `remind.ts` | Repeat rules, durations and multi-day spans, date formatting, reminder specs (`m90`, `d1@20:00`, `M1@20:00`) |
| `components/TimeGrid.tsx`, `Calendar.tsx`, `CalendarStage.tsx` | Week/day grid with per-person lanes, top bar for tasks longer than 24 h, month and year views, pinch to change scale, swipe to change period, per-person filter tabs |
| `lib/notify.ts` | Local reminders: computes trigger times from tasks and rules and schedules the nearest 60 (60-day horizon for repeats); rescheduled from scratch on every relevant change |
| `lib/background.ts` | `expo-background-task` job (every 15–30 min, as the OS allows): sync, redraw the widget, reschedule reminders |
| `src/widget/` + `modules/kstati-widget` | Upcoming tasks and a mic button on the home screen. Android: native Kotlin widget reading `widget.json`/`widget-prefs.json`; iOS: SwiftUI view through `expo-widgets` |
| `modules/kstati-net` | `isVpnActive()` on Android; the bottom bar shows a warning while a VPN is on |
| `lib/analytics.ts` | Optional AppMetrica, enabled only by `EXPO_PUBLIC_APPMETRICA_KEY` and an installed package; sends event types only, never phrase or item content |

Demo mode (`DEMO = !API_URL`): no network, sample data from `mock.ts`, simulated recording and the rule-based `mockParser.ts` that returns the same `ParseResult` shape as the server.

### Server

| Module | Responsibility |
|---|---|
| `index.ts` | Validates config, creates the store, ensures YDB tables, starts listening |
| `app.ts` | Builds the Fastify instance (separate from `index.ts` so tests run without a socket): per-IP rate limit, error mapping, `/health`, voice routes and the voice context builder |
| `auth.ts` | Email registration and password reset by emailed 6-digit code, password login, VK ID (OAuth 2.1 + PKCE + one-time ticket), HS256 tokens, `requireUser` |
| `api.ts` | `Data` class: `/sync`, `/ops` (all permission checks), `/activity`, nickname check, account deletion |
| `parse.ts`, `prompt.ts`, `spoken.ts`, `repeat.ts` | Voice understanding: prompt with a 5-week calendar and the user's data, JSON extraction, Zod validation, normalization (IDs filtered to existing ones, spans, durations, periods and repeats extracted from the phrase by code) |
| `yandex.ts`, `audio.ts` | SpeechKit and Foundation Models clients with network retries; m4a → OggOpus via `ffmpeg` |
| `mail.ts`, `sigv4.ts` | Postbox email over its SES-compatible API, SigV4 signing shared with YDB. Without `MAIL_FROM` emails are printed to the console |
| `store/` | `Store` interface with two implementations: `MemoryStore` (JSON file, local dev) and `YdbStore` (Document API) |
| `log.ts` | JSONL request log (transcript, model output, tokens, estimated cost); to stdout in the cloud, to `server/logs/` locally |

## Data model

Defined in `server/src/store/types.ts` and mirrored in `mobile/src/lib/types.ts`.

| Entity | Key | Scope |
|---|---|---|
| User | `id` | name, nick, gender, color, avatar symbol, email, password hash, VK id |
| Group | `id` | name, category (`couple`, `family`, `parents`, `friends`, `other`), invite code, owner, admins, members |
| Task / WatchItem (`items`) | `groupId + id` | shared by the group. Tasks: date, time, end date/time, repeat, done and skipped dates, reminders, people, `parentId` for sub-tasks of a plan |
| Wish | `ownerId + id` | personal, visible to people who share a group with the owner |
| Topic / Idea (`ideas`) | `ownerId + id` | personal; a topic can be opened read-only to selected groups |
| Prefs | user id | personal reminder defaults and per-task overrides |
| Activity | `scope + id` | feed of what others did: stored 45 days, served for the last 30 |

YDB tables (prefix `kstati_`): `kv` (users, groups, unique keys `email#…`/`nick#…`/`invite#…`/`vk#…`, counters, temporary records with TTL), `members`, `items`, `wishes`, `activity`, `ideas`. Objects are stored as a JSON string in attribute `v`.

## Main flows

### Edit and sync

1. A screen updates the store; the user sees the change immediately.
2. `sync.ts` diffs the lists and appends `task.put` / `watch.put` / `item.delete` / `wish.put` … to the outbox. IDs are generated on the phone, so a repeated operation is harmless.
3. `POST /ops` applies operations in order; one rejected operation does not block the rest. Every write bumps a revision counter: `grev#<group>` for group items, `urev#<user>` for wishes, `irev#<user>` for ideas, and writes an activity record.
4. When the outbox is empty, `POST /sync` sends known revisions and receives groups, people and full lists only where a revision changed. Groups with unsent edits are not overwritten.

### Voice command

1. The user records up to 10 s; the app sends base64 m4a with `groupId`, local `today`/`now`, and the open idea topic or plan.
2. The server checks group membership, takes one unit of the daily quota (`VOICE_DAILY_LIMIT`, Moscow day), converts audio with `ffmpeg` and calls SpeechKit.
3. `buildContext` loads people, the group's tasks and watch items, the user's wishes and last 60 ideas from the database — the phone's copy is never trusted.
4. YandexGPT returns JSON; non-JSON gets one retry, a schema mismatch becomes `unknown`. `normalize` keeps only candidate IDs that exist and fills dates, spans, durations and repeats parsed by code.
5. The app shows the card; only a confirmed card changes the store, which then syncs like any manual edit.

### Sign-in

Email: `/auth/email/code` stores a hash of a 6-digit code for 15 minutes (5 attempts) and emails it; `/auth/register` or `/auth/reset` verifies it and returns a token. Login is email + password with a lockout after 10 failures in 15 minutes. VK ID is implemented end to end but hidden in the app (`VK_LOGIN = false` in `app/login.tsx`).

## Deployment

A push to `main` that touches `server/` runs `.github/workflows/deploy-server.yml`: build the Docker image (Node 22 + ffmpeg), push to Container Registry, deploy a new Serverless Container revision with non-secret settings from GitHub Variables and secrets from Lockbox, then poll `/health`. The app is built locally (`npx expo run:android --variant release`) and points at the container URL through `EXPO_PUBLIC_API_URL`.
