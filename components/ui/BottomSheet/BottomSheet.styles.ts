import { StyleSheet, Dimensions, Platform } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const sheetChrome = {
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  backgroundColor: 'transparent' as const,
  overflow: 'hidden' as const,
  zIndex: 2,
  borderWidth: 0.5,
  borderColor: 'rgba(255, 255, 255, 0.12)',
  borderTopColor: 'rgba(255, 255, 255, 0.20)',
  borderBottomWidth: 0,
  ...Platform.select({
    android: {
      elevation: 24,
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    default: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 8,
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
    ...StyleSheet.absoluteFillObject,
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
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  content: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  contentCompact: {
    flexGrow: 0,
    flexShrink: 0,
    width: '100%',
    alignItems: 'stretch',
  },
});
