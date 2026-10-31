/**
 * Снимок экрана для отчёта, когда открыто окно-модалка (шторка снизу, редактор дела).
 * На Android модалка — отдельное окно, а снимок экрана берёт только главное: выходил экран под шторкой без неё.
 * Поэтому каждая модалка с кнопкой-жучком оборачивает содержимое в ModalShot, и снимается верхняя открытая модалка:
 * прозрачная (шторка) — с подложкой из снимка того, что под ней (главный экран или модалка ниже), непрозрачная — как есть.
 * На iOS снимок экрана модалки уже включает — там ничего не меняется.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { captureScreen, captureView } from '@/lib/screenshot';

type Root = { capture: () => Promise<string> };

/** Открытые модалки снизу вверх */
const stack: Root[] = [];

/** Что под модалкой с этим номером: модалка ниже или главный экран */
const below = (i: number) => (i > 0 ? stack[i - 1]!.capture() : captureScreen());

const LOAD_WAIT_MS = 600;
const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Снимок того, что сейчас видно: верхняя модалка (Android) или весь экран */
export function captureVisible(): Promise<string> {
  const top = stack[stack.length - 1];
  return Platform.OS === 'android' && top ? top.capture() : captureScreen();
}

type Props = {
  children: ReactNode;
  /** Модалка закрывает весь экран своим фоном — подложка не нужна */
  opaque?: boolean;
};

export function ModalShot({ children, opaque }: Props) {
  const ref = useRef<View>(null);
  const [under, setUnder] = useState<string | null>(null);
  const loaded = useRef<(() => void) | null>(null);
  const onLoad = useCallback(() => loaded.current?.(), []);

  useEffect(() => {
    const root: Root = {
      capture: async () => {
        if (!opaque) {
          const uri = await below(stack.indexOf(root));
          await new Promise<void>((r) => {
            const t = setTimeout(r, LOAD_WAIT_MS);
            loaded.current = () => {
              clearTimeout(t);
              r();
            };
            setUnder(uri);
          });
          loaded.current = null;
          await frames();
        }
        try {
          return await captureView(ref);
        } finally {
          setUnder(null);
        }
      },
    };
    stack.push(root);
    return () => {
      const i = stack.indexOf(root);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [opaque]);

  return (
    <View ref={ref} collapsable={false} style={styles.fill}>
      {/* Подложка совпадает с тем, что и так видно под модалкой, — человек её не замечает */}
      {under ? <Image source={{ uri: under }} fadeDuration={0} onLoad={onLoad} style={StyleSheet.absoluteFill} resizeMode="stretch" /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
