/**
 * Многострочное поле по высоте текста. На телефоне (iOS, Android) поле растёт само — пропсы не нужны.
 * В react-native-web (стенд сверки) это textarea: по умолчанию две строки и не растёт — ставим одну строку и высоту
 * по onContentSizeChange (react-native-web шлёт его и при монтировании), целым числом строк lineHeight.
 */
import { useCallback, useMemo, useState } from 'react';
import { Platform, type TextInputContentSizeChangeEvent, type TextInputProps } from 'react-native';

const WEB = Platform.OS === 'web';

export type WebAutoHeight = {
  /** Пропсы только для web (rows у textarea): в типах RN их нет */
  webProps: TextInputProps;
  onContentSizeChange: ((e: TextInputContentSizeChangeEvent) => void) | undefined;
  style: { height: number } | null;
};

const NO_PROPS: TextInputProps = {};
const WEB_ROWS: TextInputProps = Object.assign<TextInputProps, Record<string, number>>({}, { rows: 1 });
const NATIVE: WebAutoHeight = { webProps: NO_PROPS, onContentSizeChange: undefined, style: null };

export const useWebAutoHeight = (lineHeight: number): WebAutoHeight => {
  const [height, setHeight] = useState<number | null>(null);
  const onContentSizeChange = useCallback(
    (e: TextInputContentSizeChangeEvent) => setHeight(Math.max(1, Math.round(e.nativeEvent.contentSize.height / lineHeight)) * lineHeight),
    [lineHeight],
  );
  return useMemo(
    () => (WEB ? { webProps: WEB_ROWS, onContentSizeChange, style: height === null ? null : { height } } : NATIVE),
    [height, onContentSizeChange],
  );
};
