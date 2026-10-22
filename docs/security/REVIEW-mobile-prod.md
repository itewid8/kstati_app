# Проверка безопасности: приложение mobile-prod

Дата: 2026-10-22. Объём: `mobile-prod` на HEAD `88c55e9` (Expo/RN, `ru.kstati.app`, схема `kstatiapp`). Проверены исправления F13 и F14 из скана 2026-09-28, статус F12, все места, где приложение открывает адреса и принимает ссылки, хранение токена и выход, файл `kstati-state.json`, аналитика и журналы, уведомления, файлы записей голоса, заголовок `x-kstati-app`, cleartext, вход через VK (PKCE/state) и сюрприз подарка на телефоне владельца.

`node_modules` в `mobile-prod` и `mobile` нет. Поведение нативных пакетов (expo-audio, expo-file-system) описано по их документации и по тому, как их уже использует код проекта. Где это влияет на вывод, уверенность снижена.

| # | Что | Серьёзность | Уверенность | Патч |
|---|---|---|---|---|
| MP-1 | F12 не исправлен: токен, почта, коды приглашения и все данные групп лежат открытым JSON в папке, которая попадает в резервные копии | Низкая | Высокая | `mp-1.patch` (частично, Android) |
| MP-2 | Выход только локальный: скопированный токен действует до 90 дней | Низкая | Высокая | нет (нужен сервер, F8) |
| MP-3 | Файлы записей голоса не удаляются ни после отправки, ни после отмены | Низкая | Средняя | `mp-2.patch` |
| MP-4 | `usesCleartextTraffic: true` во всех сборках. В проде http не используется, но и не запрещён | Инфо | Высокая | нет |
| MP-5 | Сервер по-прежнему принимает в `wish.link` любую схему, старое приложение `mobile/` уязвимо к F13 | Инфо (для mobile-prod) | Высокая | нет |

Проверка патчей: оба сделаны от HEAD `88c55e9` и проходят `git apply --check` как по отдельности, так и вместе. В отдельной копии (`git worktree`) с обоими патчами `bash mobile-prod/scripts/test.sh` дал 178 из 178, а `bash mobile-prod/scripts/typecheck-lite.sh` — 0 ошибок. `app.json` после правки остаётся валидным JSON. Ограничение: `typecheck-lite` не проверяет `src/lib/api.ts` и `src/lib/voice.ts`. Их я прогнал только через разбор синтаксиса (`transpileModule`, 0 ошибок). Типы проверит `npm run typecheck` на Mac.

---

## MP-1. F12 в mobile-prod не исправлен

**Где:** `src/lib/storage.ts:9` (`new File(Paths.document, 'kstati-state.json')`) и `:16` (`writeNow`), `src/lib/store.ts:965–989` (`partialize`).

**Что лежит в `kstati-state.json`** (поля из `partialize`):
- `session.token` — bearer-токен на 90 дней (заголовок `X-Kstati-Token`, `net.ts:46`);
- `me`: имя, ник, пол, цвет, **почта** (`types.ts:19`), `hasPassword`, `vk`;
- `groups`, в каждой **`inviteCode`** (`types.ts:57`). По нему в группу может вступить кто угодно (F1–F3);
- `users` — профили всех участников групп; `tasks`, `wishes` (чужие хотелки с `giftedBy`/`giftedAt`), `watch`, `topics`, `ideas`, `activity`;
- `outbox` (ещё не отправленные операции), `revs`, `ideaRevs`, `overrides`, `reminders`, `lastMe`, `calendarHidden` и настройки (`theme`, `micMode`, `voiceLang`, `collapsedSections`, `activitySeen`).

Экранное состояние (карточки, запись, отмена) не сохраняется.

**Почему это риск.** `Paths.document` на iOS попадает в резервные копии iCloud и Finder. На Android `allowBackup` по умолчанию `true` (в `app.json` его нет), и файл уходит в Auto Backup на Google Диск и в `adb backup`. Тот, кто получил копию, получает токен на 90 дней, отозвать который нельзя (F8, MP-2), и коды приглашения всех групп.

**expo-secure-store.** Пакета нет ни в `mobile-prod/package.json`, ни в `mobile/package.json`, ни в `package-lock.json`, и `node_modules` тоже нет. Поэтому патча с переносом токена в secure-store нет: для него нужна новая нативная зависимость и пересборка. Предлагаемый порядок, когда её добавите (`npx expo install expo-secure-store`):
1. Держать токен в `SecureStore` с `keychainAccessible: AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: на iOS такая запись не переносится в копии. На Android Keystore тоже не переносится.
2. Убрать `session` из `partialize`. При запуске читать токен из SecureStore (`getItem` синхронный, `SecureStore.getItem`) и класть в состояние. В `signIn` писать, в `logout` вызывать `deleteItemAsync`.
3. Миграция `version: 4`: если в старом JSON есть `session.token`, перенести его в SecureStore и удалить из файла.
4. Фоновая задача (`background.ts`) идёт после первой разблокировки, так что `AFTER_FIRST_UNLOCK` ей подходит.

**Патч `mp-1.patch` (частичная мера, только Android):** `"allowBackup": false` в `android` в `app.json`. Prebuild ставит `android:allowBackup="false"`, и файл больше не попадает в облачную копию и `adb backup`. Что теряется: после переноса на новый телефон данные не восстановятся из копии, но они и так лежат на сервере и вернутся после входа. Что патч не закрывает:
- перенос «телефон в телефон» на Android 12+ при `targetSdk ≥ 31`. Здесь нужен ещё `dataExtractionRules` с исключением `file/kstati-state.json` через config-plugin;
- iOS: в expo-file-system нет `NSURLIsExcludedFromBackupKey`, нужен SecureStore (см. выше).

## MP-2. Выход не отзывает токен

**Где:** `src/lib/store.ts:384` (`logout`) и `src/containers/account/ProfileContainer.tsx:31–42`.

`logout` только обнуляет данные в памяти, и через 0,4 с файл перезаписывается без `session` (`storage.ts:33`, отложенная запись). На сервере нет ни `/auth/logout`, ни версии токена (`server/src/auth.ts`, маршруты на `:180–318`). Значит, токен, скопированный раньше (из копии, MP-1, или с чужого телефона), действует ещё до 90 дней после выхода и после смены пароля (F8, F15). Дополнительно: если приложение выгрузить в первые 0,4 с после «Выйти», старый файл с токеном останется на диске до следующего запуска. При следующем запуске человек окажется снова в аккаунте. Это неприятно, но вероятность невелика.

Что при выходе работает правильно: очищаются `outbox`, данные групп и хотелки. Уведомления снимаются: подписка в `notify.ts:122` видит смену `me`, `syncReminders` вызывает `cancelAllScheduledNotificationsAsync` и при `me = null` ничего не ставит. Синхронизация останавливается (`sync.ts:98`, `:179`), фоновая задача без `session` ничего не отправляет.

**Что сделать:** на сервере `tokenVersion` в пользователе и в JWT, `POST /auth/logout`, который его увеличивает, и такое же увеличение при смене или сбросе пароля. На телефоне в `logout` — вызов этого маршрута (без ожидания ответа) и немедленная запись файла без задержки (например, `fileStorage.removeItem('kstati-state')` перед `set`). Без серверной части патч на клиенте ничего не даёт, поэтому его нет.

## MP-3. Записи голоса копятся в кэше

**Где:** `src/components/VoiceRecorder.tsx:40` (`prepareToRecordAsync` перед каждой записью), `src/lib/voice.ts:190` (`cancelRecording`) и `:219–222` (`stopRecording`): uri из `recorder.stop()` отправляется (`api.ts:63`) или просто бросается, а файл никто не удаляет.

expo-audio на каждую подготовку записи создаёт новый файл `.m4a` в кэше приложения и сам его не удаляет. На диске остаются все команды, в том числе отменённые и слишком короткие (отмена — это обычно то, что человек передумал отправлять). Кэш не попадает в резервные копии, и система может его чистить. Поэтому риск ограничен доступом к песочнице приложения, отсюда низкая серьёзность.

Уверенность средняя: в репозитории нет исходников expo-audio. Проверить на устройстве: сделать 3–4 записи и посмотреть `cache/` (Android: `adb shell run-as ru.kstati.app ls -R cache`).

**Патч `mp-2.patch`:** в `api.ts` добавлена `deleteRecording(uri)` (тот же `File.exists`/`File.delete`, что уже в `storage.ts`). Общий `fileUriOf` вынесен из `uploadVoice`. В `voice.ts` файл удаляется после отправки (успешной или нет: «Ещё раз» всегда пишет заново, повторно файл не используется), при отмене, при слишком короткой или пустой записи и когда ответ устарел (`id !== run`). Поведение экранов не меняется.

## MP-4. Cleartext разрешён во всех сборках

**Где:** `app.json:38` (`expo-build-properties` → `android.usesCleartextTraffic: true`), `src/lib/config.ts:8`.

В проде http не используется. Адрес сервера берётся только из `EXPO_PUBLIC_API_URL`, в репозитории нет `.env` и `eas.json`, а для облака документирован `https://<container>.containers.yandexcloud.net` (`docs/installation.md:88`, `docs/deploy-yandex.md:85`). Других `http://` в коде нет, кроме примеров в комментарии `config.ts`. Ссылки хотелок открываются во внешнем браузере, и этот флаг на них не влияет.

Риск в том, что release-сборку с `http://` ничто не останавливает. Флаг нужен для тестов release на Mac по Wi-Fi (`docs/testing.md:59`). Если такую сборку раздать, токен пойдёт открытым текстом. Поэтому вместо патча рекомендация: перенести настройку в `app.config.js` и включать `usesCleartextTraffic`, только если `EXPO_PUBLIC_API_URL` начинается с `http://`. Ещё лучше перед публикацией в сторе проверять, что адрес начинается с `https://`.

## MP-5. Серверная половина F13 не сделана

`server/src/api.ts:82`: `link: z.string().max(1000)` пропускает любую схему. mobile-prod защищён на своей стороне (см. ниже), но старое приложение `mobile/app/(tabs)/wishes.tsx:159` по-прежнему вызывает `Linking.openURL(wish.link)` без проверки. Пока у людей стоит старая сборка, участник группы может подложить им `tel:`, `intent:` или `kstati://record`. Исправление: `refine` на http(s) в `WishIn` (как `safeLink`) и очистка уже сохранённых ссылок при выдаче. Это правка сервера, она вне объёма этой проверки.

---

## Проверено, проблем нет

**F13 исправлен.** `safeLink` (`src/adapters/lists/wishes.ts:35–42`) пропускает только `http(s)://хост…` и адрес без схемы (`ozon.ru/…` → `https://`), отбрасывает пробелы и управляющие символы. Он применяется дважды: в адаптере (`:83`, чужая ссылка не по http(s) не получает кнопку и домен) и прямо перед `Linking.openURL` (`src/containers/lists/WishesContainer.tsx:34–37`). Попытки обхода не прошли: `javascript:`, `intent://`, `kstatiapp:record`, `HTTP:evil` без `//`, `https:\\x`, `//host`, `%6Bstatiapp://`, `a.b:x`, перевод строки. Всё это даёт `null` или https. Тесты лежат в `wishes.test.ts:106–123`. Других мест, откуда открываются адреса, нет. По всему `mobile-prod` (app, src, modules, plugins, index.ts) нашлось только это: `Linking.openURL` — 1 вызов (выше); `Linking.openSettings` — 2 (`containers/voice/actions.ts:34`, `components/CardSheet.tsx:221`); `WebBrowser.openAuthSessionAsync` — 1 (`lib/auth.ts:83`, адрес собирается из `API_URL`); `openBrowserAsync`, `useURL`, `getInitialURL` и `addEventListener('url')` не встречаются. Ссылка своей хотелки в карточке (`components/editors.tsx:59`) — просто текст, на нажатие не реагирует.

**F14 исправлен.** `app/record.tsx:14` вызывает только `armRecording` (`lib/voice.ts:145–150`): та ставит `armed`, и VoiceHost показывает окно с кнопкой «ЗАПИСАТЬ». Микрофон и запрос разрешения (`VoiceRecorder.tsx:37`) включаются только из `beginRecording`, а её вызывают лишь нажатия: «ЗАПИСАТЬ» (`VoiceSheets.tsx:83`), REC (`useChrome.ts:33` → `toggleRecording`, режим удержания `_layout.tsx:53`), «Ещё раз» (`CardSheet.tsx:194, 289`, `actions.ts:30`). Без входа ссылка ведёт на `/login`. `startRecording` оставлен псевдонимом `armRecording` (`voice.ts:158`). Виджета и нативных точек входа нет: `index.ts`, а `modules/kstati-net` умеет только `isVpnActive`.

**Остальные ссылки `kstatiapp://…`.** `app/+native-intent` нет, так что через ссылку открывается любой маршрут. Маршруты с параметрами (`edit/task/[id]?occ&date&time&parentId`, `edit/plan/[id]?field`, `group/[id]`, `tasks/plan/[id]`, `ideas/[id]`, `settings/edit?field`) только открывают экран. Параметры подставляются как черновик или выбор поля из списка (`FIELDS.find`), а изменение сохраняется лишь по нажатию «Сохранить». Вкладки защищены проверкой входа (`app/(tabs)/_layout.tsx:10`). Обработчика нажатия на уведомление нет, `data.taskId` для навигации не используется.

**Вход через VK (PKCE и state).** `lib/auth.ts:75–95`: `code_verifier` состоит из двух UUID v4 (244 случайных бита от SecureRandom или arc4random), а `state` — из одного (122 бита). На сервер при старте уходит только `S256(verifier)` (`pkce.ts`: SHA-256 по FIPS 180-4, base64url без «=», 43 символа, как ждёт сервер). Ответ с чужим `state` отбрасывается до того, как используется билет. `verifier` предъявляется только в `/auth/vk/finish`, сервер сверяет его (`server/src/auth.ts:302–307`). Редирект в проде строгий (`auth.ts:248`). Сейчас вход через VK скрыт (`app/login.tsx:24`, `VK_LOGIN = false`): у сервера `APP_SCHEME=kstati`, у приложения `kstatiapp`. Когда будете включать, нужно точное значение `kstatiapp://auth` в `config.appScheme`, а не возврат к `exp+`.

**Сюрприз подарка на телефоне владельца.** Сервер не отдаёт владельцу `giftedBy`/`giftedAt`, пока нет `receivedAt` (`server/src/api.ts:168–174`). Лента не содержит его собственной области `u:<он>` (`api.ts:193–206`). Клиент страхуется сам. Своя хотелка остаётся в «Хочу», пока нет `receivedAt`, что бы ни лежало в `giftedBy` (`wishes.ts:28–29`). Раздел «Подарено» с дарителем (`giftedFrom`) появляется только после «получил». Событие `wish.done` о своей хотелке лента не показывает (`adapters/lists/activity.ts:43`). При снятии «получил» `giftedBy`/`giftedAt` стираются и локально (`store.ts:776–780`). Больше никто `giftedBy` не читает (карточка правки, голосовые правки и `sync.ts` его не используют). Оговорка: точка «новое» (`wishes.ts:102`) смотрит на всю ленту и могла бы выдать подарок, если бы сервер прислал событие. Сейчас он его не присылает.

**Аналитика и журналы.** AppMetrica не установлена (её нет в `package.json`), и `track` ничего не делает. Даже если её подключить, уходят только тип события и источник (`CardSheet.tsx:112`, `actions.ts:42`, `voice.ts:302`), без текста фраз и записей. `console.warn` пишет тип операции и код ошибки сервера (`sync.ts:145`) и объекты ошибок (`sync.ts:301`, `notify.ts:102`, `storage.ts:18`). Содержимого дел, хотелок и токена в журналах нет.

**Уведомления.** Только локальные (`lib/notify.ts`), push не используются (`plugins/withoutPushEntitlement.js`). Заголовок — название дела, текст — «Завтра в 19:00 · <группа>», `data: { taskId }`. На экране блокировки их видно целиком. Если это нежелательно, каналу `reminders` можно поставить `lockscreenVisibility: PRIVATE` (мелочь, не находка).

**`x-kstati-app`** = `ru.kstati.app/<version>(<build>)` (`net.ts:12–14`, `:43`). Идентификаторов устройства и личных данных в нём нет. Мелочь: на iOS номер сборки берётся из `android.versionCode`, потому что это поле проверяется первым.
