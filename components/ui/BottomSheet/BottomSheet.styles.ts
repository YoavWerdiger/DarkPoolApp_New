import { StyleSheet, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const createStyles = (backgroundColor: string, backdropColor: string) => StyleSheet.create({
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
    backgroundColor: backgroundColor,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 2,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  content: {
    flex: 1,
  },
});

