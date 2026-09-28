#!/usr/bin/env bash
# Собрать образ, загрузить в Container Registry и выкатить новую ревизию Serverless Container.
# Первый раз — пройдите docs/deploy-yandex.md; дальше достаточно: ./scripts/deploy.sh
# Настройки берутся из server/deploy.env (не секреты; секреты — в Lockbox).
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f deploy.env ] || { echo "Нет server/deploy.env — скопируйте deploy.env.example и заполните"; exit 1; }
# shellcheck disable=SC1091
source deploy.env

TAG="v$(date +%Y%m%d-%H%M%S)"
IMAGE="cr.yandex/${REGISTRY_ID}/kstati-server:${TAG}"

echo "→ Сборка ${IMAGE}"
docker build --platform linux/amd64 -t "${IMAGE}" .
echo "→ Загрузка в Container Registry"
docker push "${IMAGE}"

echo "→ Новая ревизия контейнера ${CONTAINER_NAME}"
yc serverless container revision deploy \
  --folder-id "${FOLDER_ID}" \
  --container-name "${CONTAINER_NAME}" \
  --image "${IMAGE}" \
  --service-account-id "${SA_ID}" \
  --memory 512MB \
  --cores 1 \
  --core-fraction 100 \
  --concurrency 8 \
  --execution-timeout 60s \
  --environment "NODE_ENV=production,LOG_DIR=stdout,YANDEX_FOLDER_ID=${FOLDER_ID},YANDEX_MODEL=${YANDEX_MODEL},PUBLIC_URL=${PUBLIC_URL},APP_SCHEME=${APP_SCHEME},YDB_DOCAPI_ENDPOINT=${YDB_DOCAPI_ENDPOINT},VK_CLIENT_ID=${VK_CLIENT_ID},MAIL_FROM=${MAIL_FROM},VOICE_DAILY_LIMIT=${VOICE_DAILY_LIMIT}" \
  --secret "environment-variable=JWT_SECRET,id=${LOCKBOX_ID},key=JWT_SECRET" \
  --secret "environment-variable=YANDEX_API_KEY,id=${LOCKBOX_ID},key=YANDEX_API_KEY" \
  --secret "environment-variable=AWS_ACCESS_KEY_ID,id=${LOCKBOX_ID},key=AWS_ACCESS_KEY_ID" \
  --secret "environment-variable=AWS_SECRET_ACCESS_KEY,id=${LOCKBOX_ID},key=AWS_SECRET_ACCESS_KEY"

echo "→ Проверка"
curl -fsS "${PUBLIC_URL}/health" && echo && echo "✓ Готово: ${PUBLIC_URL}"
