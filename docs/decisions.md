# Technical decisions

## Yandex Cloud for everything

**Decision:** Serverless Containers, YDB, Lockbox, Postbox, SpeechKit and YandexGPT.
**Why:** the audience is in Russia and the app must work without a VPN; foreign clouds and LLM APIs are unreliable or blocked there. Serverless Containers and serverless YDB cost nothing at idle and fit free tiers at this scale, so the main cost is voice.
**Trade-off:** vendor lock-in and fewer libraries; mitigated by keeping every Yandex call behind small hand-written clients (`yandex.ts`, `mail.ts`, `store/ydb.ts`).

## No SDKs on the server

**Decision:** the server depends only on `fastify` and `zod`. YDB is used through its DynamoDB-compatible Document API with a self-written SigV4 signer that also signs Postbox requests; JWT (HS256) and password hashing (`scrypt`) use `node:crypto`.
**Why:** a small image and fast cold starts for Serverless Containers, nothing to audit or upgrade beyond two packages.
**Rejected:** the YDB SDK (gRPC, heavy) and AWS SDK.

## Offline-first phone, idempotent operations, revision sync

**Decision:** the store is persisted on the phone; edits become operations with phone-generated IDs in an outbox; `/sync` exchanges per-group and per-person revision numbers and returns whole lists only where something changed.
**Why:** a couple or a small group has little data, so “resend the whole changed list” is simpler and more robust than field-level deltas or CRDTs. Client IDs make a retried `/ops` batch harmless, and the app stays usable on a bad connection.
**Trade-off:** last write wins per record; groups with unsent local edits are not overwritten by the server until the outbox drains.

## The model only lays out the phrase

**Decision:** YandexGPT returns JSON under a fixed schema; it never executes anything. Server code validates the JSON, drops IDs that do not exist or are not accessible, and the user confirms a card before anything changes.
**Why:** an LLM that invents a task ID or deletes the wrong item is worse than one that says “not understood”. Deterministic code is also cheaper to test.
**Details:**
- the prompt includes a 5-week calendar table because models miscount weekdays;
- time spans, durations, date ranges, “until …” and repeats are extracted from the phrase by code (`spoken.ts`, `repeat.ts`) and override the model;
- non-JSON output gets one retry; JSON that fails the schema becomes `unknown` without a retry, because a retry usually repeats the mistake and costs tokens;
- “what are our plans” queries: the model only names *whose* and *when*, the app (`plans.ts`) chooses groups and tasks.

## The server builds the voice context

**Decision:** for `/voice` the phone sends only the group, local date/time and the open topic or plan; people, tasks, wishes and ideas are read from the database.
**Why:** the phone is not trusted, the request stays small, and the model cannot be fed records the user has no access to.

## Short voice clips and a daily quota

**Decision:** recordings are 0.7–10 s, AAC mono 16 kHz (~30 KB for 7 s), converted to OggOpus with `ffmpeg` for SpeechKit; each user has `VOICE_DAILY_LIMIT` commands per Moscow day; every call is logged with tokens and estimated cost.
**Why:** short commands parse more accurately and cost less; the quota and log keep spending predictable. `yandexgpt-lite` is the default because it is several times cheaper; `npm run eval` compares models on the same phrase set.

## Token in `X-Kstati-Token`

**Decision:** the app sends the session token in a custom header; `Authorization: Bearer` is accepted only as a fallback for local debugging.
**Why:** Yandex Serverless Containers consumes the `Authorization` header (expects an IAM token) and answers 403.

## Email codes plus password, VK ID postponed

**Decision:** registration and password reset are confirmed by a 6-digit emailed code; daily login is email + password. Codes are stored hashed with the server secret, expire in 15 minutes and allow 5 attempts; login locks after 10 failures in 15 minutes; all routes share a 120 requests/minute per-IP limit. VK ID (OAuth 2.1 + PKCE with a one-time ticket bound to the app's own verifier, so an intercepted `kstati://` link is useless) is implemented but hidden behind `VK_LOGIN` until a VK business profile is set up.
**Why:** a password avoids waiting for an email on every login; the code proves ownership of the address once.

## Local reminders instead of push

**Decision:** reminders are computed on the phone and scheduled as local notifications (nearest 60, 60-day horizon for repeats); a background task syncs and reschedules every 15–30 minutes.
**Why:** no push infrastructure or paid Apple account is needed, and reminders fire offline. The `withoutPushEntitlement` plugin removes the push entitlement so a free Apple account can sign iOS builds.
**Trade-off:** a task added by another member reaches a closed app only on the next background refresh.

## Native code where libraries fell short

- **Android widget** as a local Kotlin module that reads JSON files written by the app, so the widget renders without starting JS.
- **`withIpv4First`**: Yandex Cloud hosts have IPv6; on networks with broken IPv6, OkHttp without timeouts hung forever. The plugin installs an OkHttp factory that tries IPv4 first and abandons a stuck connection after 10 s.
- **`kstati-net`**: VPNs often break access to Yandex Cloud; the app checks `ConnectivityManager` and shows a permanent warning next to the mic.
- **`withWorkManagerFix`** pins `work-runtime-ktx` to avoid duplicate WorkManager classes.

## Demo mode

**Decision:** with no `EXPO_PUBLIC_API_URL` the app runs on sample data with simulated recording and a local rule-based parser that returns the same `ParseResult` as the server.
**Why:** UI work and design reviews do not need a server or Yandex credits, and the shared format keeps both paths honest.

## Personal vs shared data

- Tasks and watch items belong to a group.
- Wishes belong to a person and are visible to everyone who shares a group with them, so others can pick gifts; only the owner edits them.
- Ideas are a personal notebook; a topic can be opened read-only to chosen groups.
- Invite codes are visible only to the group owner and admins.

## Deployment from GitHub Actions

**Decision:** push to `main` (paths `server/**`) builds and deploys the container; non-secret IDs are GitHub Variables, server secrets stay in Lockbox, GitHub holds only the deployer key.
**Why:** no Docker needed on the Mac, and secrets never pass through the repository or CI logs.
