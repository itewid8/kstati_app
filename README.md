# Кстати

## 📚 Documentation
| | |
|---|---|
| [⚙️ Architecture](docs/architecture.md) | System design, components and flow |
| [📁 Structure](docs/structure.md) | Project organization and responsibilities |
| [🚀 Installation](docs/installation.md) | Requirements and steps to run the project |
| [🧠 Technical decisions](docs/decisions.md) | Trade-offs and design justifications |
| [📖 Usage guide](docs/usage.md) | How the app is used: flows and voice examples |
| [🔌 API](docs/api.md) | HTTP endpoints, request/response and errors |
| [🧪 Testing](docs/testing.md) | Server tests, model evaluation, type checks |
| [☁️ Yandex Cloud deployment](docs/deploy-yandex.md) | One-time cloud setup (in Russian) |
| [🎙 Voice command contract](docs/voice-api.md) | Parse result format shared by server and app (in Russian) |

---

## Description

«Кстати» is a voice-first shared planner for couples, families and groups of friends. Four lists live in one app:

- **Дела** — tasks and plans with dates, times, durations, repeats, participants and sub-tasks, shown as a list or a week/day/month/year calendar;
- **Хочу** — a personal wishlist that the people in your groups can see (“what should I give Masha?”);
- **Смотреть** — a shared watchlist of movies and series with kind, genres and origin;
- **Идеи** — a personal notebook of ideas grouped by topics, optionally opened read-only to a group.

The main input is a short voice phrase: «В субботу в семь ужин у родителей», «Мы посмотрели Интерстеллар», «Что у друзей на выходных?». The server transcribes it with Yandex SpeechKit, YandexGPT lays it out into a strict JSON schema, server code validates and completes it, and the app shows a card the user confirms before anything is changed.

The product targets Russia and must work without a VPN, so the whole backend runs on Yandex Cloud (Serverless Containers, YDB, Lockbox, Postbox, AI Studio).

## Quick start

Run the server locally on a file database and point the Android emulator at it:

```bash
# server (terminal 1)
cd server
npm install
cp .env.example .env          # set YANDEX_API_KEY
npm run dev                   # http://localhost:3000, emulator: http://10.0.2.2:3000

# app (terminal 2)
cd mobile
npm install
echo 'EXPO_PUBLIC_API_URL=http://10.0.2.2:3000' > .env
npx expo run:android
```

Without `EXPO_PUBLIC_API_URL` the app starts in demo mode: in-memory sample data, simulated recording and a local rule-based parser (`mobile/src/lib/mockParser.ts`).

## Technologies used

| Area | Stack |
|---|---|
| Mobile | Expo SDK 57, React Native 0.86, TypeScript, Expo Router, Zustand (persisted to a JSON file), Reanimated 4, Gesture Handler, react-native-svg, expo-audio, expo-notifications, expo-background-task, expo-widgets |
| Native code | Local Expo modules in Kotlin: `kstati-widget` (Android home-screen widget), `kstati-net` (VPN detection); config plugins for IPv4-first networking, WorkManager versions and iOS push entitlement |
| Server | Node 22, Fastify 5, Zod, `tsx` for dev, `tsc` for the production build |
| AI | Yandex SpeechKit (speech-to-text), YandexGPT via Foundation Models API (`yandexgpt-lite/latest` by default) |
| Data | YDB serverless through the Document API (DynamoDB protocol, SigV4 signing, no SDK); a JSON file store for local development |
| Infrastructure | Yandex Serverless Containers, Container Registry, Lockbox, Postbox (email), GitHub Actions deploy |
| Design | Geist and Geist Mono, monochrome theme with per-person colors |

## Quick installation

1. Install Node 22, Android Studio (SDK, emulator, JDK) and, for voice on a local server, `ffmpeg`.
2. `npm install` in `server/` and `mobile/`, fill `server/.env` and `mobile/.env`.
3. `npm run dev` in `server/`, `npx expo run:android` in `mobile/`.

Details, environment variables and cloud deployment: [docs/installation.md](docs/installation.md).

## Architecture (summary)

The phone is the source of truth for the user's own edits and keeps working offline: every change becomes an idempotent operation in a persisted outbox, which is pushed to `POST /ops`; `POST /sync` then returns only the groups and people whose revision changed. The server owns permissions, shared data and the voice pipeline: audio → ffmpeg → SpeechKit → YandexGPT with a context built from the database → deterministic post-processing → a `ParseResult` that the app turns into a confirmation card. Reminders are local notifications, and a background task refreshes data, the widget and reminders while the app is closed. See [docs/architecture.md](docs/architecture.md).

## Project structure

```
.github/workflows/   server deploy to Yandex Cloud on push to main
docs/                documentation, cloud setup, voice contract
mobile/              Expo app
  app/               screens (Expo Router)
  src/components/    UI: calendar, sheets, rows, recorder, pickers
  src/lib/           store, sync, voice, auth, dates, repeats, reminders
  src/widget/        widget data and iOS widget view
  modules/           local native modules (widget, VPN check)
  plugins/           Expo config plugins
server/              Fastify API
  src/               routes, auth, voice parsing, Yandex clients, storage
  test/              unit and end-to-end tests
  eval/              phrase evaluation against the real model
  scripts/           YDB tables, deploy, log stats, read-only inspection
```

Full tree and responsibilities: [docs/structure.md](docs/structure.md).
