import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Запись длиннее этого обрезаем: приложение останавливает запись на 10 с, секунда — запас */
const MAX_SEC = 11;

/**
 * Любой звук (m4a/aac/wav…) → OggOpus моно 48 кГц для SpeechKit и длительность исходной записи в секундах.
 * Нужен ffmpeg (brew install ffmpeg).
 * Вход пишем во временный файл: у m4a служебный блок бывает в конце, из потока ffmpeg его не прочитает.
 */
export async function toOggOpus(input: Buffer): Promise<{ ogg: Buffer; seconds: number | null }> {
  const dir = await mkdtemp(join(tmpdir(), 'kstati-'));
  const src = join(dir, 'in');
  await writeFile(src, input);
  try {
    return await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'info', '-nostats', '-i', src, '-t', String(MAX_SEC), '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '32k', '-f', 'ogg', 'pipe:1']);
      const out: Buffer[] = [];
      let err = '';
      ff.stdout.on('data', (d) => out.push(d));
      ff.stderr.on('data', (d) => (err += d));
      ff.on('error', (e) => reject(new Error(`ffmpeg не найден: ${e.message}. Установите: brew install ffmpeg`)));
      ff.on('close', (code) => {
        if (code !== 0) return reject(new Error(`ffmpeg: ${err.split('\n').filter((l) => /error|invalid/i.test(l)).join(' ').slice(0, 300) || err.slice(-300)}`));
        // «Duration: 00:00:04.12» — длительность исходника (до обрезки)
        const m = err.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
        const seconds = m ? Math.round((+m[1] * 3600 + +m[2] * 60 + +m[3]) * 10) / 10 : null;
        resolve({ ogg: Buffer.concat(out), seconds });
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
