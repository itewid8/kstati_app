/**
 * Клавиатура в окне редактирования (дела и плана):
 *  - поле, в которое печатают (описание в строке «ОПИСАНИЕ»), не прячется под клавиатурой — поля прокручиваются;
 *  - под полями добавляется место на высоту клавиатуры, чтобы было куда прокрутить;
 *  - поле сообщает о фокусе через KeyboardTargetContext (FieldInputRow).
 * Координаты — measureInWindow и верх клавиатуры (endCoordinates.screenY): так сдвиг верный и когда Android сжимает окно
 * под клавиатуру, и когда клавиатура его перекрывает (edge-to-edge, iOS).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, Platform, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView, type View } from 'react-native';
import { keyboardOverlap, revealDelta } from './revealMath';

/** Поле в фокусе (его строка) или null — фокус ушёл */
export type KeyboardTarget = (node: View | null) => void;

const noTarget: KeyboardTarget = () => undefined;
export const KeyboardTargetContext = createContext<KeyboardTarget>(noTarget);
export const useKeyboardTarget = () => useContext(KeyboardTargetContext);

/** Зазор между полем и клавиатурой */
const GAP = 12;

/** Где прокрутка внутри окна: отступ сверху и снизу (над кнопками) */
export type ScrollFrame = { top: number; bottom: number };

type Refs = {
  /** Корень окна: его низ — низ экрана */
  root: RefObject<View | null>;
  scroll: RefObject<ScrollView | null>;
};

export function useEditorKeyboard({ root, scroll }: Refs, frame: ScrollFrame) {
  const [space, setSpace] = useState(0);
  const keyboardTop = useRef<number | null>(null);
  const offset = useRef(0);
  const target = useRef<View | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  /** Прокрутить так, чтобы поле в фокусе было над клавиатурой и под заголовком */
  const reveal = useCallback(() => {
    const field = target.current;
    const kb = keyboardTop.current;
    const host = root.current;
    if (!field || kb === null || !host) return;
    host.measureInWindow((_x, y, _w, h) => {
      const { top, bottom } = frameRef.current;
      const view = { top: y + top, bottom: Math.min(y + h - bottom, kb) - GAP };
      field.measureInWindow((_fx, fy, _fw, fh) => {
        const delta = revealDelta({ top: fy, bottom: fy + fh }, view);
        if (delta !== 0) scroll.current?.scrollTo({ y: Math.max(0, offset.current + delta), animated: true });
      });
    });
  }, [root, scroll]);

  useEffect(() => {
    // iOS — сразу, вместе с анимацией клавиатуры; Android шлёт только «did»
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const kb = e.endCoordinates.screenY;
      keyboardTop.current = kb;
      root.current?.measureInWindow((_x, y, _w, h) => setSpace(keyboardOverlap(y + h, kb)));
      reveal();
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardTop.current = null;
      setSpace(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [root, reveal]);

  const setTarget = useCallback<KeyboardTarget>(
    (node) => {
      target.current = node;
      // Клавиатура уже открыта (перешли из названия в описание) — событий клавиатуры не будет
      if (node) reveal();
    },
    [reveal],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  /** Место под клавиатурой появилось или описание выросло на строку — снова к полю */
  const onContentSizeChange = useCallback(() => reveal(), [reveal]);

  return { space, setTarget, onScroll, onContentSizeChange };
}
