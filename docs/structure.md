# Project structure

```
kstati/
├── .github/workflows/
│   └── deploy-server.yml        build image → Container Registry → new container revision → /health
├── docs/
│   ├── architecture.md, structure.md, installation.md, decisions.md, usage.md, api.md, testing.md
│   ├── deploy-yandex.md         one-time Yandex Cloud setup (service account, YDB, Lockbox, registry, Postbox, VK ID)
│   └── voice-api.md             voice parse contract between server and app
├── mobile/
│   ├── app/                     Expo Router screens
│   │   ├── _layout.tsx          fonts, theme, sync start, global sheets and pull indicator
│   │   ├── index.tsx            redirect: login / onboarding / tabs
│   │   ├── login.tsx            email + password, registration and reset by code
│   │   ├── onboarding.tsx       create the first group or join by code
│   │   ├── record.tsx           kstati://record — opens straight into recording
│   │   ├── group.tsx            group name, category, invite, members and roles
│   │   ├── activity.tsx         feed of other members' actions
│   │   ├── (tabs)/
│   │   │   ├── tasks/index.tsx  list or calendar of tasks
│   │   │   ├── tasks/[id].tsx   plan screen: sub-tasks on a grid or as a checklist
│   │   │   ├── wishes.tsx       Хочу
│   │   │   ├── watch.tsx        Смотреть
│   │   │   └── ideas/           topics and ideas
│   │   └── settings/            profile, avatar and color, app settings, reminder defaults
│   ├── src/
│   │   ├── components/          UI building blocks (see below)
│   │   ├── lib/                 state, sync, domain logic
│   │   ├── widget/              widget snapshot, Android config screen, iOS widget view
│   │   └── theme.ts             colors (light/dark), fonts, sizes, motion
│   ├── modules/
│   │   ├── kstati-widget/       Kotlin home-screen widget + config activity
│   │   └── kstati-net/          Kotlin VPN check
│   ├── plugins/                 Expo config plugins (IPv4-first OkHttp, WorkManager pin, no iOS push entitlement)
│   ├── assets/                  icons and splash
│   ├── app.json                 Expo config: scheme `kstati`, package `ru.wwp.app`, widgets, plugins
│   └── index.ts                 entry: background task, Android widget config component, router
└── server/
    ├── src/
    │   ├── index.ts, app.ts     startup and HTTP app
    │   ├── auth.ts, api.ts      accounts and data routes
    │   ├── parse.ts, prompt.ts, spoken.ts, repeat.ts, types.ts   voice understanding
    │   ├── yandex.ts, audio.ts, mail.ts, sigv4.ts                external services
    │   ├── log.ts, config.ts
    │   └── store/               Store interface, MemoryStore, YdbStore
    ├── test/                    repeat, ideas, duration, e2e + fake Document API
    ├── eval/run.ts              phrase set against the real model
    ├── scripts/                 ydb-tables, deploy.sh, stats, inspect
    ├── Dockerfile               Node 22 + ffmpeg, runs dist/index.js
    ├── .env.example             local settings
    └── deploy.env.example       non-secret cloud IDs for manual deploy and scripts
```

## mobile/src/lib

| File | Contents |
|---|---|
| `store.ts` | the app state and all actions; `DEMO` flag |
| `storage.ts` | JSON-file persistence for Zustand |
| `sync.ts` | outbox, `/ops`, `/sync`, activity polling, sync scheduling |
| `net.ts`, `config.ts` | `request()` with `ApiError`/`NetError`; `API_URL` from `EXPO_PUBLIC_API_URL` |
| `auth.ts`, `pkce.ts` | sign-in calls; PKCE for VK ID |
| `voice.ts`, `api.ts` | recording control and voice requests |
| `mockParser.ts`, `mock.ts`, `spokenRepeat.ts` | demo-mode parser and data |
| `types.ts` | shared domain types (mirrors the server) |
| `dates.ts`, `recur.ts`, `span.ts` | dates, repeats, durations and spans |
| `remind.ts`, `notify.ts`, `background.ts` | reminder rules, local notifications, background refresh |
| `plans.ts` | answers to “what are our plans” queries |
| `colors.ts` | person palette, automatic color assignment, contrast-aware text color |
| `dupes.ts`, `ideas.ts`, `activity.ts` | duplicate warnings, idea helpers, feed texts |
| `useMark.ts`, `ids.ts`, `analytics.ts` | delayed “done” mark, ID generation, optional AppMetrica |

## mobile/src/components

| Group | Files |
|---|---|
| Primitives | `ui.tsx` (`T`, `Button`, `Chip`, `Toggle`, `Checkbox`, `Field`, `ListRow`, `Divider`, `SectionLabel`), `icons.tsx`, `Avatar.tsx`, `Logo.tsx` |
| Layout | `Header.tsx`, `BottomBar.tsx` (tabs, mic, VPN warning), `PullRefresh.tsx`, `Sheet.tsx`, `UndoToast.tsx` |
| Lists | `TaskRow.tsx`, `ListItem.tsx`, `SwipeRow.tsx` |
| Calendar | `CalendarStage.tsx` (gestures, person tabs), `Calendar.tsx` (week/day/month/year), `TimeGrid.tsx` |
| Editing | `CardSheet.tsx`, `editors.tsx`, `TaskEditor.tsx`, `pickers.tsx`, `RepeatPanel.tsx`, `ReminderEditor.tsx` |
| Sheets | `ActionMenu.tsx`, `FilterSheet.tsx`, `GroupSheet.tsx`, `TopicShareSheet.tsx`, `NoGroup.tsx` |
| Voice | `VoiceRecorder.tsx` |

## Boundaries

- Colors, fonts and sizes belong in `src/theme.ts` and `src/lib/colors.ts`, not in components.
- Domain rules shared by voice and UI (repeats, spans, reminders) live in `src/lib`, never in screens.
- Permission checks belong only in `server/src/api.ts` and `auth.ts`; the app may hide actions but is never trusted.
- Anything the model returns passes through `parse.ts` before reaching the app.
- Secrets never go into `deploy.env`, `.env.example` or the repository: they live in Lockbox and the GitHub secret `YC_SA_JSON_KEY`. `server/.env`, `deploy.env`, `server/.data/`, logs, keystores and `inspect.txt` are git-ignored.
- `mobile/android/` and `mobile/ios/` are generated by `expo run` and are not committed.
