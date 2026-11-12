# Своя модель разбора голосовых команд для Yandex Serverless Containers (linux/amd64):
# сервер llama.cpp (OpenAI-совместимый) и веса модели в одном образе.
# Веса — файл kstati.gguf рядом с этим Dockerfile (в git не кладётся: получается из дообученной модели).
FROM ghcr.io/ggml-org/llama.cpp:server
COPY kstati.gguf /models/kstati.gguf
# Порт задаёт Serverless Containers (PORT); ключ доступа — OWN_LLM_KEY из Lockbox, тот же, что у сервера приложения.
# Один запрос за раз на экземпляр: фраза разбирается всеми ядрами, очередь создаёт сам облачный сервис
ENTRYPOINT ["/bin/sh", "-c", "exec /app/llama-server -m /models/kstati.gguf --host 0.0.0.0 --port ${PORT:-8080} -c 2048 -t ${THREADS:-4} --parallel 1 --no-webui ${OWN_LLM_KEY:+--api-key $OWN_LLM_KEY}"]
