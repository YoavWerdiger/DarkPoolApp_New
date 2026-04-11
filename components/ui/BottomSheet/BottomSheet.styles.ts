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
    backgroundColor: 'transparent', // שקוף - ה-BlurView מספק את הרקע
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
    zIndex: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.20)',
    borderBottomWidth: 0,
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
    position: 'relative', // כדי להיות מעל ה-BlurView
    zIndex: 1,
  },
});

