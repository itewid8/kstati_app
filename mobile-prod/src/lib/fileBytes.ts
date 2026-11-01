/** Чтение и удаление файлов по uri (запись голоса, выбранные файлы). Телефон — expo-file-system; браузер — fileBytes.web.ts */
import { File } from 'expo-file-system';

/** «file://…» или путь без схемы → uri файла */
const fileUri = (uri: string) => (/^(file|content):\/\//.test(uri) ? uri : `file://${uri}`);

export const readBytes = async (uri: string): Promise<ArrayBuffer> => new File(fileUri(uri)).arrayBuffer();
export const readText = async (uri: string): Promise<string> => new File(fileUri(uri)).textSync();

export function removeFile(uri: string) {
  try {
    const f = new File(fileUri(uri));
    if (f.exists) f.delete();
  } catch {
    /* файла уже нет */
  }
}
