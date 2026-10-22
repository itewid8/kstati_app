/**
 * Начертания, которые использует src/ui (tokens.fonts). Передать в useFonts в app/_layout:
 *   const [loaded] = useFonts(uiFonts);
 * Ключи совпадают с fontFamily в tokens.ts.
 */
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium, GeistMono_600SemiBold } from '@expo-google-fonts/geist-mono';

export const uiFonts = {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  GeistMono_400Regular,
  GeistMono_500Medium,
  GeistMono_600SemiBold,
};
