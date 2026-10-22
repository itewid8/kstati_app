/** Типы шрифтов @expo-google-fonts для scripts/typecheck-lite.sh: модуль .ttf — число (ассет Metro) */
declare module '@expo-google-fonts/geist' {
  export const Geist_400Regular: number;
  export const Geist_500Medium: number;
  export const Geist_600SemiBold: number;
  export const Geist_700Bold: number;
  export function useFonts(map: Record<string, number>): [boolean, Error | null];
}
declare module '@expo-google-fonts/geist-mono' {
  export const GeistMono_400Regular: number;
  export const GeistMono_500Medium: number;
  export const GeistMono_600SemiBold: number;
}
