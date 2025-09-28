import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Modal, Dimensions, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { MessageSnapshot } from '../../types/MessageSnapshot';
import ReactionBar from './ReactionBar';
import { DesignTokens } from '../ui/DesignTokens';
import ContextMenu from './ContextMenu';
import { supabase } from '../../lib/supabase';

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
  const [isAdmin, setIsAdmin] = React.useState(false);

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
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const menuSlideAnim = useRef(new Animated.Value(300)).current;
  const menuOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // פתיחה: רקע + תצוגות
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
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
      // סגירה
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
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
      ]).start();
    }
  }, [visible]);

  if (!visible || !message) return null;

  const handleReaction = (emoji: string) => {
    onAction('react', { messageId: message?.id, emoji });
  };

  const handleOptionSelect = (option: string) => {
    onAction(option, message);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <BlurView
            intensity={60}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        </View>
      </TouchableWithoutFeedback>

      <View style={styles.container} pointerEvents="box-none">
        {/* Reaction Bar */}
        <Animated.View
          style={[
            styles.reactionWrapper,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View>
              <ReactionBar onReaction={handleReaction} />
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Bottom Action Sheet - מותאם, כך שהריאקציות יופיעו מעליו */}
        <Animated.View
          style={[
            styles.actionSheet,
            {
              opacity: menuOpacityAnim,
              transform: [{ translateY: menuSlideAnim }]
            }
          ]}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  reactionWrapper: {
    position: 'absolute',
    top: '15%',
    zIndex: 20,
  },
  actionSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
});
