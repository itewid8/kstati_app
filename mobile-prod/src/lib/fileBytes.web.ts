/** Браузер: uri — это blob: или data: (запись микрофона, выбранный файл), читаем через fetch */
export const readBytes = async (uri: string): Promise<ArrayBuffer> => (await fetch(uri)).arrayBuffer();
export const readText = async (uri: string): Promise<string> => (await fetch(uri)).text();

export function removeFile(uri: string) {
  if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
}
