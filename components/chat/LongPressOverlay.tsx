import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Modal, Dimensions, Animated, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSnapshot } from '../../types/MessageSnapshot';
import ReactionBar from './ReactionBar';
import { DesignTokens } from '../ui/DesignTokens';
import ContextMenu from './ContextMenu';
import { supabase } from '../../lib/supabase';

// רטט קצר ועדין בעת פתיחת התצוגה (עם fallback אם אין expo-haptics)
let Haptics: any = { selectionAsync: async () => {}, impactAsync: async () => {}, ImpactFeedbackStyle: { Light: 'Light' } };
try { Haptics = require('expo-haptics'); } catch {}

interface LongPressOverlayProps {
  visible: boolean;
  message: MessageSnapshot | null;
  onClose: () => void;
  onAction: (actionName: string, payload?: any) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');


export default function LongPressOverlay({
  visible,
  message,
  onClose,
  onAction
}: LongPressOverlayProps) {
  const insets = useSafeAreaInsets();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);

  React.useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        const channelId = message?.channelId;
        if (!userId || !channelId) return;

        const { data, error } = await supabase
          .from('channel_members')
          .select('role')
          .eq('channel_id', channelId)
          .eq('user_id', userId)
          .single();

        if (!error && data) {
          setIsAdmin(data.role === 'admin' || data.role === 'owner');
        }
      } catch {}
    };
    fetchRole();
  }, [message]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const menuSlideAnim = useRef(new Animated.Value(300)).current;
  const menuOpacityAnim = useRef(new Animated.Value(0)).current;

  // עדכן shouldRender מיד כש-visible משתנה ל-true
  useEffect(() => {
    if (visible && message) {
      console.log('🎯 LongPressOverlay: Setting shouldRender to true immediately, message:', message.id);
      setShouldRender(true);
    } else if (!visible && shouldRender) {
      // נשאיר shouldRender עד שהאנימציה מסתיימת (נסגור ב-animation callback)
    }
  }, [visible, message]);

  useEffect(() => {
    if (visible && message) {
      console.log('🎯 LongPressOverlay: Opening overlay, message:', message.id);
      // רטט קצר מאוד בעת פתיחה (אסתטי ועדין)
      try { Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light); } catch {}

      // איפוס ערכים לפני אנימציה - נתחיל מ-1 כדי שהתוכן יהיה נראה מיד
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      menuOpacityAnim.setValue(1);
      menuSlideAnim.setValue(0);
      console.log('🎯 LongPressOverlay: Animation values set to visible, starting animations');

      // פתיחה: נעשה אנימציה עדינה מהמצב הנוכחי
      // קודם נציג את התוכן מיד ואז נעשה אנימציה עדינה
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(menuOpacityAnim, {
            toValue: 1,
            duration: 250,
            delay: 50,
            useNativeDriver: true,
          }),
          Animated.spring(menuSlideAnim, {
            toValue: 0,
            tension: 80,
            friction: 8,
            delay: 50,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else if (!visible && shouldRender) {
      // סגירה - האנימציה רצה ואז נסגר המודל
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(menuOpacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(menuSlideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // סגור את המודל רק אחרי שהאנימציה מסתיימת
        console.log('🎯 LongPressOverlay: Closing animation finished, setting shouldRender to false');
        setShouldRender(false);
      });
    }
  }, [visible, message, shouldRender]);

  // אם אין message או visible הוא false, לא נרנדר (אלא אם כן אנחנו באמצע אנימציית סגירה)
  if (!message || (!visible && !shouldRender)) {
    return null;
  }

  const handleReaction = (emoji: string) => {
    onAction('react', { messageId: message?.id, emoji });
  };

  const handleOptionSelect = (option: string) => {
    onAction(option, message);
  };

  return (
    <Modal 
      visible={shouldRender} 
      transparent 
      animationType="none" 
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={60}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]} />
          )}
        </View>
      </TouchableWithoutFeedback>

      <View style={styles.container} pointerEvents="box-none">
        {/* Reaction Bar */}
        <Animated.View
          style={[
            styles.reactionWrapper,
            {
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
                extrapolate: 'clamp'
              }),
              transform: [{ translateY: slideAnim }]
            }
          ]}
          pointerEvents="auto"
        >
          <View pointerEvents="auto">
            <ReactionBar onReaction={handleReaction} />
          </View>
        </Animated.View>

        {/* Bottom Action Sheet */}
        <Animated.View
          style={[
            styles.actionSheet,
            {
              opacity: menuOpacityAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
                extrapolate: 'clamp'
              }),
              transform: [{ translateY: menuSlideAnim }],
            }
          ]}
          pointerEvents="auto"
        >
          <View style={{ paddingBottom: Math.max(insets.bottom, 20) }} pointerEvents="auto">
            {console.log('🎯 LongPressOverlay: Rendering ContextMenu, isAdmin:', isAdmin)}
            <ContextMenu onSelect={handleOptionSelect} isAdmin={isAdmin} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(0,0,0,0.4)',
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 100,
  },
  reactionWrapper: {
    zIndex: 20,
    elevation: 20,
  },
  actionSheet: {
    width: '100%',
    zIndex: 10,
    elevation: 10,
    backgroundColor: 'transparent',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
