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

  useEffect(() => {
    if (visible) {
      console.log('🎯 LongPressOverlay: Opening overlay');
      setShouldRender(true);
      // רטט קצר מאוד בעת פתיחה (אסתטי ועדין)
      try { Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light); } catch {}

      // איפוס ערכים לפני אנימציה
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      menuOpacityAnim.setValue(0);
      menuSlideAnim.setValue(300);
      console.log('🎯 LongPressOverlay: Animation values reset, menuSlideAnim starts at 300');

      // פתיחה: רקע + תצוגות
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
            delay: 100,
            useNativeDriver: true,
          }),
          Animated.spring(menuSlideAnim, {
            toValue: 0,
            tension: 80,
            friction: 8,
            delay: 100,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    } else {
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
        setShouldRender(false);
      });
    }
  }, [visible]);

  if (!shouldRender || !message) return null;

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
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View>
              <ReactionBar onReaction={handleReaction} />
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Bottom Action Sheet */}
        <Animated.View
          style={[
            styles.actionSheet,
            {
              opacity: menuOpacityAnim,
              transform: [{ translateY: menuSlideAnim }],
            }
          ]}
          pointerEvents="box-none"
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
              {console.log('🎯 LongPressOverlay: Rendering ContextMenu, isAdmin:', isAdmin)}
              <ContextMenu onSelect={handleOptionSelect} isAdmin={isAdmin} />
            </View>
          </TouchableWithoutFeedback>
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
  },
  actionSheet: {
    width: '100%',
    zIndex: 10,
    backgroundColor: 'transparent',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
