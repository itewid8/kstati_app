/**
 * Снимок экрана и обработка картинки для отчёта: react-native-view-shot (снимок) и expo-image-manipulator (обрезка, сжатие).
 * Модули подключаются через require: типы здесь свои, минимальные.
 */
import type { RefObject } from 'react';
import type { View } from 'react-native';

type CaptureOptions = { format?: 'jpg' | 'png'; quality?: number; result?: 'tmpfile' | 'base64' };
type ViewShot = {
  captureScreen: (o?: CaptureOptions) => Promise<string>;
  captureRef: (ref: RefObject<View | null>, o?: CaptureOptions) => Promise<string>;
};
type Action = { crop: { originX: number; originY: number; width: number; height: number } } | { resize: { width?: number; height?: number } };
type Manipulator = {
  manipulateAsync: (uri: string, actions: Action[], o: { compress?: number; format?: string; base64?: boolean }) => Promise<{ uri: string; width: number; height: number; base64?: string }>;
  SaveFormat: { JPEG: string };
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const shot = (): ViewShot => require('react-native-view-shot') as ViewShot;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const manip = (): Manipulator => require('expo-image-manipulator') as Manipulator;

/** Снимок всего экрана приложения (файл JPEG) */
export const captureScreen = () => shot().captureScreen({ format: 'jpg', quality: 0.9, result: 'tmpfile' });

/** Снимок одного вида (картинка с рамкой поверх) */
export const captureView = (ref: RefObject<View | null>) => shot().captureRef(ref, { format: 'jpg', quality: 0.9, result: 'tmpfile' });

/** Обрезать картинку по прямоугольнику (в пикселях картинки) */
export async function cropImage(uri: string, r: { x: number; y: number; w: number; h: number }) {
  const m = manip();
  const out = await m.manipulateAsync(uri, [{ crop: { originX: Math.round(r.x), originY: Math.round(r.y), width: Math.round(r.w), height: Math.round(r.h) } }], {
    compress: 0.95,
    format: m.SaveFormat.JPEG,
  });
  return out;
}

/** Ширина снимка для отправки: текст ещё читается, файл — около 80–150 КБ */
export const SEND_WIDTH = 900;

/** Для отправки: не шире SEND_WIDTH, JPEG 0.5, сразу base64 */
export async function jpegBase64(uri: string, width: number): Promise<string | null> {
  const m = manip();
  const out = await m.manipulateAsync(uri, width > SEND_WIDTH ? [{ resize: { width: SEND_WIDTH } }] : [], { compress: 0.5, format: m.SaveFormat.JPEG, base64: true });
  return out.base64 ?? null;
}

/** Размер картинки */
export async function imageSize(uri: string) {
  const out = await manip().manipulateAsync(uri, [], {});
  return { width: out.width, height: out.height };
}
