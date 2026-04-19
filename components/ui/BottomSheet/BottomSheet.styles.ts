import { StyleSheet, Dimensions, Platform } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const createStyles = (backdropColor: string) => StyleSheet.create({
  /** שורש מודל — חובה flex:1 באנדרואיד כדי שה־backdrop ימלא את המסך */
  modalRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: backdropColor,
    zIndex: 1,
  },
  container: {
    position: 'absolute',
    width: '100%',
    top: 0, // מתחיל מלמעלה ומוזז ע"י translateY
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT, // גובה מלא
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: 'transparent', // שקוף - ה-BlurView מספק את הרקע
    overflow: 'hidden',
    zIndex: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.20)',
    borderBottomWidth: 0,
    /** iOS: צל · Android: elevation בלבד (צל מתעלמים ממנו) */
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
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  /** מעל שכבות ה-Blur + זכוכית — שקוף כדי לראות טשטוש */
  content: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
    backgroundColor: 'transparent',
  },
});

