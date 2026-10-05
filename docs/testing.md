# Testing

## Server tests

```bash
cd server
npm test
```

Runs four scripts with `tsx`, in order; each uses `node:assert` and exits non-zero on the first failure. None of them touch the network or Yandex.

| File | Covers |
|---|---|
| `test/repeat.ts` | spoken repeats («каждую субботу», «по будням», «раз в две недели по средам»…) → `Repeat` and the first date; parsing a phrase with a repeat using a hand-written model answer |
| `test/ideas.ts` | where an idea lands (named topic, open topic, «Без темы»), new topics, moving ideas, «покажи идеи» — through `parse.ts` normalization |
| `test/duration.ts` | time spans, “until”, durations, date ranges, participants and sub-tasks from phrases and model answers |
| `test/e2e.ts` | the whole HTTP API through `app.inject`: registration by code, login, password reset, nicknames, groups, invites, roles and removal, sync and revisions, wishes, idea topics and ideas, the activity feed, voice with stubbed STT/LLM, the daily quota, account deletion, VK ID with stubbed VK endpoints |

`e2e.ts` runs the same scenario twice: on `MemoryStore` and on `YdbStore` against `test/fake-docapi.ts`, an in-memory implementation of exactly the Document API calls and condition expressions that `store/ydb.ts` uses. This catches storage-specific bugs without a real YDB.

Type check:

```bash
npm run typecheck
```

## Model evaluation

Unlike the tests, `eval` calls the real YandexGPT and costs tokens.

```bash
npm run eval                                   # whole phrase set, model from .env
npm run eval -- дача                           # only phrases containing «дача»
YANDEX_MODEL=yandexgpt/latest npm run eval     # compare another model
npm run eval -- --replay                       # free: replay the last logged model answers through the current code
```

“Today” is fixed to Friday 2026-09-25 so expected dates are stable. Each line shows ✓/✗, latency, tokens and, on failure, what differed; the summary shows total tokens and estimated cost. `--replay` is the way to check a change in `parse.ts`, `spoken.ts` or `repeat.ts` without paying for the model.

## Request log

Every voice, text and eval request is written to the JSONL log with transcript, model output, tokens and estimated cost:

```bash
npm run stats              # all time
npm run stats -- 7         # last 7 days
npm run stats -- 7 voice   # voice | text | eval
```

## Mobile

There are no automated UI tests. Checks are:

```bash
cd mobile
npm run typecheck          # tsc --noEmit
```

plus manual testing on a device with a release build (`npx expo run:android --variant release`). Demo mode (empty `EXPO_PUBLIC_API_URL`) exercises screens and the voice card flow without a server.
