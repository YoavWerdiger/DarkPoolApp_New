import {
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_600SemiBold,
  Heebo_700Bold,
  useFonts,
} from '@expo-google-fonts/heebo';
import { Assistant_600SemiBold } from '@expo-google-fonts/assistant';
import { APP_FONT } from './appFont';

export function useLoadAppFonts(): boolean {
  const [loaded] = useFonts({
    [APP_FONT.regular]: Heebo_400Regular,
    [APP_FONT.medium]: Heebo_500Medium,
    [APP_FONT.semiBold]: Heebo_600SemiBold,
    [APP_FONT.bold]: Heebo_700Bold,
    [APP_FONT.cta]: Assistant_600SemiBold,
  });
  return loaded;
}
