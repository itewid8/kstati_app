/**
 * Типы react-native для scripts/typecheck-lite.sh и scripts/test.sh (без node_modules приложения).
 * Только то, что используют src/screens, src/ui и адаптеры: явные экспорты, колбэки с типами параметров.
 * Неизвестные пропсы разрешены (индексная сигнатура unknown), но колбэк без объявления даст TS7006 — так шим
 * не прячет ошибки в обработчиках. Полная проверка — `npm run typecheck` на Mac.
 */
declare module 'react-native' {
  import { Component, type ComponentType, type ReactNode, type Ref } from 'react';

  type Falsy = undefined | null | false | '' | 0;
  type Loose = { [key: string]: unknown };

  export type ColorValue = string;
  export type DimensionValue = number | string;

  export type ViewStyle = Loose & {
    width?: DimensionValue;
    height?: DimensionValue;
    flex?: number;
    opacity?: number;
    backgroundColor?: ColorValue;
    borderColor?: ColorValue;
  };
  export type TextStyle = ViewStyle & { color?: ColorValue; fontFamily?: string; fontSize?: number; lineHeight?: number; letterSpacing?: number };
  export type ImageStyle = ViewStyle;

  export type RegisteredStyle<T> = number & { __registeredStyleBrand: T };
  export type StyleProp<T> = T | RegisteredStyle<T> | ReadonlyArray<StyleProp<T>> | Falsy;

  export type Insets = { top?: number; left?: number; bottom?: number; right?: number };
  export type LayoutRectangle = { x: number; y: number; width: number; height: number };
  export type NativeSyntheticEvent<T> = { nativeEvent: T; preventDefault(): void; stopPropagation(): void };
  export type LayoutChangeEvent = NativeSyntheticEvent<{ layout: LayoutRectangle }>;
  export type GestureResponderEvent = NativeSyntheticEvent<{
    locationX: number;
    locationY: number;
    pageX: number;
    pageY: number;
    timestamp: number;
  }>;
  export type AccessibilityActionInfo = { name: string; label?: string };
  export type AccessibilityActionEvent = NativeSyntheticEvent<{ actionName: string }>;
  export type NativeScrollEvent = {
    contentOffset: { x: number; y: number };
    contentSize: { width: number; height: number };
    layoutMeasurement: { width: number; height: number };
  };
  export type TextInputChangeEvent = NativeSyntheticEvent<{ text: string }>;
  export type TextInputSubmitEditingEvent = NativeSyntheticEvent<{ text: string }>;
  export type TextInputContentSizeChangeEvent = NativeSyntheticEvent<{ contentSize: { width: number; height: number } }>;
  export type TextInputKeyPressEventData = { key: string };
  export type TextInputSelectionChangeEventData = { selection: { start: number; end: number } };

  export type AccessibilityRole = string;
  export type AccessibilityState = { disabled?: boolean; selected?: boolean; checked?: boolean | 'mixed'; busy?: boolean; expanded?: boolean };

  type AccessibilityProps = {
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    accessibilityRole?: AccessibilityRole;
    accessibilityState?: AccessibilityState;
    accessibilityValue?: { min?: number; max?: number; now?: number; text?: string };
    accessibilityActions?: ReadonlyArray<AccessibilityActionInfo>;
    onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
    accessibilityViewIsModal?: boolean;
    accessibilityElementsHidden?: boolean;
    importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
    accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
    testID?: string;
    nativeID?: string;
  };

  type TouchProps = {
    onTouchStart?: (event: GestureResponderEvent) => void;
    onTouchMove?: (event: GestureResponderEvent) => void;
    onTouchEnd?: (event: GestureResponderEvent) => void;
    onTouchCancel?: (event: GestureResponderEvent) => void;
    onStartShouldSetResponder?: (event: GestureResponderEvent) => boolean;
    onResponderGrant?: (event: GestureResponderEvent) => void;
    onResponderRelease?: (event: GestureResponderEvent) => void;
  };

  export type ViewProps = Loose &
    AccessibilityProps &
    TouchProps & {
      children?: ReactNode;
      style?: StyleProp<ViewStyle>;
      pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
      hitSlop?: Insets | number | null;
      onLayout?: (event: LayoutChangeEvent) => void;
      collapsable?: boolean;
    };

  export type TextProps = Loose &
    AccessibilityProps & {
      children?: ReactNode;
      style?: StyleProp<TextStyle>;
      numberOfLines?: number;
      ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
      allowFontScaling?: boolean;
      maxFontSizeMultiplier?: number | null;
      selectable?: boolean;
      onPress?: (event: GestureResponderEvent) => void;
      onLongPress?: (event: GestureResponderEvent) => void;
      onLayout?: (event: LayoutChangeEvent) => void;
      onTextLayout?: (event: NativeSyntheticEvent<{ lines: ReadonlyArray<LayoutRectangle & { text: string }> }>) => void;
    };

  export type PressableStateCallbackType = { pressed: boolean; hovered?: boolean; focused?: boolean };

  export type PressableProps = Omit<ViewProps, 'children' | 'style'> & {
    children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
    style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
    disabled?: boolean | null;
    onPress?: ((event: GestureResponderEvent) => void) | null;
    onPressIn?: ((event: GestureResponderEvent) => void) | null;
    onPressOut?: ((event: GestureResponderEvent) => void) | null;
    onLongPress?: ((event: GestureResponderEvent) => void) | null;
    delayLongPress?: number | null;
    android_ripple?: { color?: ColorValue; borderless?: boolean; radius?: number } | null;
  };

  export type ScrollViewProps = ViewProps & {
    contentContainerStyle?: StyleProp<ViewStyle>;
    horizontal?: boolean | null;
    showsVerticalScrollIndicator?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    bounces?: boolean;
    scrollEnabled?: boolean;
    scrollEventThrottle?: number;
    keyboardShouldPersistTaps?: boolean | 'always' | 'never' | 'handled';
    contentOffset?: { x: number; y: number };
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onContentSizeChange?: (width: number, height: number) => void;
  };

  export type TextInputProps = Omit<ViewProps, 'style'> & {
    style?: StyleProp<TextStyle>;
    value?: string;
    defaultValue?: string;
    placeholder?: string;
    placeholderTextColor?: ColorValue;
    multiline?: boolean;
    maxLength?: number;
    autoFocus?: boolean;
    editable?: boolean;
    selectionColor?: ColorValue;
    cursorColor?: ColorValue;
    returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send' | 'default';
    submitBehavior?: 'submit' | 'blurAndSubmit' | 'newline';
    blurOnSubmit?: boolean;
    keyboardType?: string;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    autoCorrect?: boolean;
    textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center';
    onChangeText?: (text: string) => void;
    onChange?: (event: TextInputChangeEvent) => void;
    onKeyPress?: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
    onSelectionChange?: (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => void;
    onSubmitEditing?: (event: TextInputSubmitEditingEvent) => void;
    onFocus?: (event: NativeSyntheticEvent<object>) => void;
    onBlur?: (event: NativeSyntheticEvent<object>) => void;
    onContentSizeChange?: (event: TextInputContentSizeChangeEvent) => void;
  };

  export type KeyboardAvoidingViewProps = ViewProps & {
    behavior?: 'height' | 'position' | 'padding';
    keyboardVerticalOffset?: number;
    enabled?: boolean;
    contentContainerStyle?: StyleProp<ViewStyle>;
  };

  export type ModalProps = Omit<ViewProps, 'style'> & {
    visible?: boolean;
    transparent?: boolean;
    animationType?: 'none' | 'slide' | 'fade';
    statusBarTranslucent?: boolean;
    navigationBarTranslucent?: boolean;
    presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
    onRequestClose?: () => void;
    onShow?: () => void;
    onDismiss?: () => void;
  };

  export class View extends Component<ViewProps> {
    measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
  }
  export class Text extends Component<TextProps> {}
  export class ScrollView extends Component<ScrollViewProps> {
    scrollTo(options?: { x?: number; y?: number; animated?: boolean }): void;
    scrollToEnd(options?: { animated?: boolean }): void;
  }
  export class TextInput extends Component<TextInputProps> {
    focus(): void;
    blur(): void;
    clear(): void;
    isFocused(): boolean;
  }
  export class KeyboardAvoidingView extends Component<KeyboardAvoidingViewProps> {}
  export class Modal extends Component<ModalProps> {}
  export const ActivityIndicator: ComponentType<Loose & { size?: "small" | "large" | number; color?: string }>;
  export const Pressable: ComponentType<PressableProps & { ref?: Ref<View> }>;

  type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };
  export const StyleSheet: {
    create<T extends NamedStyles<T>>(styles: T & NamedStyles<T>): T;
    flatten<T>(style?: StyleProp<T>): T;
    compose<T>(a: StyleProp<T>, b: StyleProp<T>): StyleProp<T>;
    readonly absoluteFill: ViewStyle;
    readonly absoluteFillObject: { position: 'absolute'; left: 0; right: 0; top: 0; bottom: 0 };
    readonly hairlineWidth: number;
  };

  export type PlatformOSType = 'ios' | 'android' | 'macos' | 'windows' | 'web';
  export const Platform: {
    OS: PlatformOSType;
    Version: number | string;
    select<T>(specifics: { [K in PlatformOSType | 'default' | 'native']?: T }): T;
    constants?: Record<string, unknown>;
  };

  export type ScaledSize = { width: number; height: number; scale: number; fontScale: number };
  export const Dimensions: { get(dim: 'window' | 'screen'): ScaledSize };
  export const Linking: { openURL(url: string): Promise<void>; openSettings(): Promise<void>; canOpenURL(url: string): Promise<boolean> };
  export function useWindowDimensions(): ScaledSize;
  export type ColorSchemeName = 'light' | 'dark' | 'unspecified' | null | undefined;
  export function useColorScheme(): ColorSchemeName;

  export type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';
  export type NativeEventSubscription = { remove(): void };
  export const AppState: {
    currentState: AppStateStatus;
    addEventListener(type: 'change', listener: (state: AppStateStatus) => void): NativeEventSubscription;
  };

  export type KeyboardEvent = { endCoordinates: { height: number; screenX: number; screenY: number; width: number }; duration?: number };
  export type EmitterSubscription = { remove(): void };
  export const Keyboard: {
    dismiss(): void;
    addListener(event: 'keyboardWillShow' | 'keyboardDidShow' | 'keyboardWillHide' | 'keyboardDidHide', cb: (e: KeyboardEvent) => void): EmitterSubscription;
  };
}
