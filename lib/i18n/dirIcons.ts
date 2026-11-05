/**
 * אייקוני lucide כיווניים — באנגלית (ממשק מראה) מתחלפים שמאל↔ימין.
 * בעברית / ערבית — אותו אייקון בדיוק.
 */
import {
  ArrowLeft as LArrowLeft,
  ArrowRight as LArrowRight,
  ChevronLeft as LChevronLeft,
  ChevronRight as LChevronRight,
} from 'lucide-react-native';
import { IS_RTL_UI } from './direction';

export const ChevronLeft = IS_RTL_UI ? LChevronLeft : LChevronRight;
export const ChevronRight = IS_RTL_UI ? LChevronRight : LChevronLeft;
export const ArrowLeft = IS_RTL_UI ? LArrowLeft : LArrowRight;
export const ArrowRight = IS_RTL_UI ? LArrowRight : LArrowLeft;
