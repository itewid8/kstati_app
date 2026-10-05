# Сервер «Кстати» в Yandex Cloud

Схема: **Serverless Containers** (наш сервер) + **YDB** в бессерверном режиме (база, Document API) + **Lockbox** (секреты) + **Postbox** (письма) + **AI Studio** (SpeechKit и YandexGPT, как сейчас). Всё в каталоге `b1gqk5stlpkbea0mi0da`.

На старте сервер и база укладываются в бесплатные лимиты Яндекса; платим в основном за голос.

## 0. Что поставить на Mac

```bash
brew install yandex-cloud-cli jq      # или: curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
brew install --cask docker            # Docker Desktop — собирать образ
yc init                               # войти, выбрать облако и каталог b1gqk5stlpkbea0mi0da
```

## 1. Сервисный аккаунт и права

```bash
FOLDER=b1gqk5stlpkbea0mi0da
yc iam service-account create --name kstati-server
SA_ID=$(yc iam service-account get kstati-server --format json | jq -r .id)
for ROLE in ydb.editor ai.languageModels.user ai.speechkit-stt.user postbox.sender lockbox.payloadViewer container-registry.images.puller; do
  yc resource-manager folder add-access-binding $FOLDER --role $ROLE --subject serviceAccount:$SA_ID
done
echo "SA_ID=$SA_ID"
```

Ключи этого аккаунта (сохраните вывод — секрет показывается один раз):

```bash
yc iam access-key create --service-account-name kstati-server   # key_id и secret → AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
yc iam api-key create --service-account-name kstati-server      # secret → YANDEX_API_KEY (или используйте ключ voice-app)
```

## 2. База YDB

```bash
yc ydb database create kstati --serverless
yc ydb database get kstati --format json | jq -r .document_api_endpoint   # → YDB_DOCAPI_ENDPOINT
```

Создать таблицы (с Mac, ключи из шага 1):

```bash
cd ~/kstati/server
YDB_DOCAPI_ENDPOINT=… AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… npm run tables
# ✓ YDB отвечает, таблицы готовы
```

## 3. Секреты в Lockbox

```bash
JWT=$(openssl rand -base64 48)
yc lockbox secret create --name kstati-secrets --payload "[
  {\"key\":\"JWT_SECRET\",\"text_value\":\"$JWT\"},
  {\"key\":\"YANDEX_API_KEY\",\"text_value\":\"<ключ из шага 1>\"},
  {\"key\":\"AWS_ACCESS_KEY_ID\",\"text_value\":\"<key_id>\"},
  {\"key\":\"AWS_SECRET_ACCESS_KEY\",\"text_value\":\"<secret>\"}
]"
yc lockbox secret get kstati-secrets --format json | jq -r .id   # → LOCKBOX_ID
```

## 4. Реестр образов и контейнер

```bash
yc container registry create --name kstati
yc container registry get kstati --format json | jq -r .id       # → REGISTRY_ID
yc container registry configure-docker

yc serverless container create --name kstati-api
yc serverless container allow-unauthenticated-invoke --name kstati-api
yc serverless container get kstati-api --format json | jq -r .url # → PUBLIC_URL (без / в конце)
```

## 5. Выкладка

```bash
cd ~/kstati/server
cp deploy.env.example deploy.env && open -e deploy.env   # заполнить ID из шагов 1–4
chmod +x scripts/deploy.sh
./scripts/deploy.sh                                      # сборка, загрузка, новая ревизия, проверка /health
```

Каждая следующая выкладка — снова `./scripts/deploy.sh`.

В приложении `mobile/.env`: `EXPO_PUBLIC_API_URL=<PUBLIC_URL>` и пересборка.

## 6. Почта (Postbox)

Письма с кодами уходят только с подтверждённого домена. Нужен свой домен (например, `kstati.app`, ~200–1000 ₽ в год):

1. Консоль → Postbox → «Создать адрес» → домен → добавить у регистратора DNS-записи, которые покажет Яндекс (DKIM).
2. После подтверждения: `MAIL_FROM=noreply@<домен>` в `deploy.env` → `./scripts/deploy.sh`.

Пока почта не настроена, регистрация по почте в облаке не работает (коды пишутся в журнал контейнера); вход через VK ID работает.

## 7. VK ID

1. [id.vk.com](https://id.vk.com) → «Подключить VK ID» → создать приложение, платформа «Web».
2. Доверенный Redirect URL: `<PUBLIC_URL>/auth/vk/callback`. Базовый домен: домен из `PUBLIC_URL`.
3. ID приложения → `VK_CLIENT_ID` в `deploy.env` → `./scripts/deploy.sh`.

## 8. Бюджет

Консоль → Биллинг → «Бюджеты» → бюджет на месяц (например, 2 000 ₽) с оповещениями на 50/80/100 % — чтобы расходы на голос не стали сюрпризом. Суточный лимит голосовых команд на человека — `VOICE_DAILY_LIMIT` (по умолчанию 30).

## Журнал и отладка

- Журнал голосовых запросов и ошибки: Консоль → Serverless Containers → kstati-api → Логи (строки `"kind":"voice-log"`).
- Локально всё работает без облака: `npm run dev` (база — файл `server/.data/dev.json`, письма — в консоль), `npm test` — сквозные тесты.
