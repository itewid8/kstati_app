# Installation

## Prerequisites

| What | Why |
|---|---|
| Node.js 22 | server (`process.loadEnvFile`, Docker image is `node:22-slim`) and the Expo toolchain |
| Android Studio | Android SDK, emulator and the bundled JDK for `expo run:android` |
| Xcode (macOS, optional) | iOS builds; the `withoutPushEntitlement` plugin lets a free Apple account sign the app |
| `ffmpeg` | only for `POST /voice` on a local server (m4a → OggOpus): `brew install ffmpeg` |
| Yandex Cloud folder + API key with SpeechKit and YandexGPT access | voice recognition and parsing |
| Yandex Cloud CLI, Docker | only for manual cloud deployment and maintenance scripts |

## 1. Clone

```bash
git clone https://github.com/itewid8/kstati_app.git ~/kstati
cd ~/kstati
```

## 2. Server

```bash
cd ~/kstati/server
npm install
cp .env.example .env
open -e .env
```

`server/.env` (never commit it):

| Variable | Required | Notes |
|---|---|---|
| `YANDEX_API_KEY` | yes | API key of the service account used for SpeechKit and YandexGPT |
| `YANDEX_FOLDER_ID` | yes | folder with AI Studio access |
| `YANDEX_MODEL` | no | `yandexgpt-lite/latest` (default, cheaper) or `yandexgpt/latest` |
| `PORT` | no | default `3000` |
| `JWT_SECRET` | prod only | token signing key; locally a dev default is used, in production it is mandatory |
| `DB` | no | `memory` or `ydb`; defaults to `ydb` when `YDB_DOCAPI_ENDPOINT` is set, otherwise `memory` |
| `DATA_FILE` | no | file for the memory store, default `server/.data/dev.json` |
| `YDB_DOCAPI_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | for YDB / Postbox | static key of the server's service account |
| `MAIL_FROM` | no | sender on a domain verified in Postbox; empty — emails (with codes) are printed to the console |
| `PUBLIC_URL`, `APP_SCHEME`, `VK_CLIENT_ID` | for VK ID | external server URL, app scheme (`kstati`), VK app ID |
| `VOICE_DAILY_LIMIT` | no | voice commands per user per day, default `30` |
| `LOG_DIR` | no | request log folder, default `server/logs/`; `stdout` in the cloud |
| `LLM_PRICE_PER_1K` | no | overrides the price used for cost estimates in the log |

Run:

```bash
npm run dev       # tsx watch, restarts on changes
```

Check:

```bash
curl http://localhost:3000/health
# {"ok":true,"model":"yandexgpt-lite/latest","db":"memory"}
```

Locally the response to `/auth/email/code` contains `devCode` when mail is not configured, so registration works without Postbox.

## 3. Mobile app (Android)

One-time setup on macOS:

1. Install Android Studio and finish the Standard setup wizard (SDK + emulator).
2. Add to `~/.zshrc` and restart the terminal:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   ```
3. For a physical phone: enable Developer options and USB debugging, connect it, check `adb devices`.

Install and configure:

```bash
cd ~/kstati/mobile
npm install
```

`mobile/.env` selects the server (restart Metro after changing it):

```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000          # Android emulator → server on this Mac
# EXPO_PUBLIC_API_URL=http://192.168.1.47:3000    # phone on the same Wi-Fi → Mac's IP
# EXPO_PUBLIC_API_URL=https://<container>.containers.yandexcloud.net   # cloud server
# empty or missing → demo mode without a server
```

Optional: `EXPO_PUBLIC_APPMETRICA_KEY` (plus the `@appmetrica/react-native-analytics` package) enables analytics.

Build and run:

```bash
npx expo run:android                       # debug build with Fast Refresh
npx expo run:android --variant release     # release build, as used for testing on the phone
```

The first build takes 5–10 minutes. After that, JS changes in a debug build arrive through Fast Refresh; if Metro is stopped, run `npx expo start --dev-client`. A rebuild is needed after adding native packages, changing `app.json`, plugins or `modules/`, and for every change in a release build.

iOS: `npx expo run:ios` on a Mac with Xcode.

## 4. Cloud server

First-time setup of the service account, YDB, Lockbox, Container Registry, Serverless Container and Postbox is described in [deploy-yandex.md](deploy-yandex.md). Create the tables once:

```bash
cd ~/kstati/server
YDB_DOCAPI_ENDPOINT=… AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… npm run tables
```

Deploys then run from GitHub Actions on every push to `main` that touches `server/`, or manually via **Actions → «Выкладка сервера» → Run workflow**. The workflow needs:

| GitHub setting | Values |
|---|---|
| Secret | `YC_SA_JSON_KEY` — JSON key of the deployer service account |
| Variables | `FOLDER_ID`, `REGISTRY_ID`, `SA_ID`, `LOCKBOX_ID`, `CONTAINER_NAME`, `PUBLIC_URL`, `YDB_DOCAPI_ENDPOINT`, `YANDEX_MODEL`, `APP_SCHEME`, `VK_CLIENT_ID`, `MAIL_FROM`, `VOICE_DAILY_LIMIT` |
| Lockbox entries | `JWT_SECRET`, `YANDEX_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |

`server/scripts/deploy.sh` does the same build and deploy from a Mac using `server/deploy.env` and Docker.

Verify a deploy: the workflow's last step polls `<PUBLIC_URL>/health`; container logs are in the console under Serverless Containers → Logs.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `✗ Не заполнено: …` on server start | a required variable is missing in `server/.env` |
| `expo run:android` complains about SDK or Java | check `ANDROID_HOME` and `JAVA_HOME` from step 3 |
| App shows sample data after setting the URL | Metro was not restarted after editing `mobile/.env` |
| “Нет связи с сервером” on a phone | wrong IP or the phone is on another network; a VPN on the phone (the red triangle next to the mic) often blocks Yandex Cloud |
| `/voice` fails locally, `/voice/text` works | `ffmpeg` is not installed |
