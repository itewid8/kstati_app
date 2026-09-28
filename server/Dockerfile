# Сервер «Кстати» для Yandex Serverless Containers (linux/amd64)
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
# ffmpeg — перевод записи m4a в OggOpus для SpeechKit
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production LOG_DIR=stdout
COPY package.json package-lock.json* ./
RUN (npm ci --omit=dev || npm install --omit=dev) && npm cache clean --force
COPY --from=build /app/dist ./dist
# Serverless Containers передаёт порт в PORT
CMD ["node", "dist/index.js"]
