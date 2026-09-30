import { StyleSheet, Dimensions, Platform } from 'react-native';
import {
  SHEET_HANDLE_BORDER_RADIUS,
  SHEET_HANDLE_FILL,
  SHEET_HANDLE_HEIGHT,
  SHEET_HANDLE_WIDTH,
} from './sheetGlass';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/** כרום זכוכית: רדיוס רך, שפה עליונה מוארת וצל קל — כדי שהשיט "יצוף" מעל התוכן. */
const sheetChrome = {
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  backgroundColor: 'transparent' as const,
  overflow: 'hidden' as const,
  zIndex: 2,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(255, 255, 255, 0.08)',
  borderTopColor: 'rgba(255, 255, 255, 0.12)',
  borderBottomWidth: 0,
  ...Platform.select({
    android: {
      elevation: 12,
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 6,
    },
  }),
};

export const createStyles = (backdropColor: string) => StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  systemBarFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: backdropColor,
    zIndex: 1,
  },
  /** שיט רגיל — גובה מלא, מוזז ע"י translateY */
  container: {
    position: 'absolute',
    width: '100%',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    ...sheetChrome,
  },
  /** fitContent — מעוגן לתחתית, גובה דינמי (ללא top) */
  fitContentContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    ...sheetChrome,
  },
  /** פס גרירה — capsule אפור בהיר אטום, בלי outline. */
  handle: {
    width: SHEET_HANDLE_WIDTH,
    height: SHEET_HANDLE_HEIGHT,
    borderRadius: SHEET_HANDLE_BORDER_RADIUS,
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: SHEET_HANDLE_FILL,
  },
  content: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  /** ממלא את גובה fitContentContainer (animated height) — חובה לשיטים גבוהים עם ScrollView */
  contentCompact: {
    height: '100%',
    width: '100%',
    minHeight: 0,
    alignItems: 'stretch',
    backgroundColor: 'transparent',
  },
});
