/**
 * Заметки из файлов: выбор (expo-document-picker) и чтение — архив Google Takeout (.zip, распаковка fflate),
 * отдельные заметки Keep (.json), .txt и .md. Модули подключаются через require: нет в сборке — available() false.
 */
import { readBytes, readText } from './fileBytes';
import { logError } from './diag';
import { fromKeepJson, fromTextFile, type IncomingNote } from './noteImport';

type Picked = { uri: string; name: string; mimeType?: string | null; size?: number | null };
type Picker = { getDocumentAsync: (o: { type?: string | string[]; multiple?: boolean; copyToCacheDirectory?: boolean }) => Promise<{ canceled: boolean; assets: Picked[] | null }> };
type Fflate = {
  unzipSync: (data: Uint8Array, o?: { filter?: (f: { name: string; originalSize: number }) => boolean }) => Record<string, Uint8Array>;
  strFromU8: (d: Uint8Array) => string;
};

function load<T>(name: 'expo-document-picker' | 'fflate'): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (name === 'fflate' ? require('fflate') : require('expo-document-picker')) as T;
  } catch {
    return null;
  }
}

export const noteFilesAvailable = () => !!load<Picker>('expo-document-picker') && !!load<Fflate>('fflate');

export type NoteFiles = { label: string; source: 'keep' | 'files'; notes: IncomingNote[] };

const MAX_ENTRY = 2_000_000;

/** Выбрать файлы и прочитать заметки; отменили — null */
export async function pickNoteFiles(): Promise<NoteFiles | null> {
  const picker = load<Picker>('expo-document-picker');
  const zip = load<Fflate>('fflate');
  if (!picker || !zip) throw new Error('Нет модулей выбора файлов в сборке');
  const res = await picker.getDocumentAsync({ type: ['application/zip', 'application/json', 'text/*', 'application/octet-stream'], multiple: true, copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const notes: IncomingNote[] = [];
  let keep = false;
  for (const [i, a] of res.assets.entries()) {
    const name = a.name ?? `файл ${i + 1}`;
    const lower = name.toLowerCase();
    try {
      if (lower.endsWith('.zip')) {
        const bytes = new Uint8Array(await readBytes(a.uri));
        const entries = zip.unzipSync(bytes, {
          filter: (f) => f.originalSize < MAX_ENTRY && /\.(json|txt|md)$/i.test(f.name) && !/\/(Labels|labels)\.txt$/.test(f.name),
        });
        for (const [path, data] of Object.entries(entries)) {
          const key = `${i}:${path}`;
          const text = zip.strFromU8(data);
          if (/\.json$/i.test(path)) {
            try {
              const n = fromKeepJson(JSON.parse(text), key);
              if (n) {
                notes.push(n);
                keep = true;
              }
            } catch {
              /* не заметка Keep */
            }
          } else {
            const n = fromTextFile(path.split('/').pop() ?? path, text, key);
            if (n) notes.push(n);
          }
        }
      } else if (lower.endsWith('.json')) {
        const n = fromKeepJson(JSON.parse(await readText(a.uri)), `${i}`);
        if (n) {
          notes.push(n);
          keep = true;
        }
      } else {
        const n = fromTextFile(name, await readText(a.uri), `${i}`);
        if (n) notes.push(n);
      }
    } catch (e) {
      logError(e);
    }
  }
  const label = res.assets.length === 1 ? (res.assets[0]?.name ?? 'Файл') : `Файлов: ${res.assets.length}`;
  return { label, source: keep ? 'keep' : 'files', notes: notes.filter((n) => !n.trashed) };
}
