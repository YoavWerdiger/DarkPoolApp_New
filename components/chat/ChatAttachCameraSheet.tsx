/**
 * מצלמת צירוף לצ'אט — תצוגה מלאה כמו בסטוריז, בלי עריכת סטורי.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DayNavBlurButton } from '../ui/DayNavBlurButton';
import { chromeSurfaceCardStyle } from '../ui/chromeControl';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { legacyAlert } from '../../utils/appDialog';

export type ChatAttachCameraResult = {
  uri: string;
  width?: number;
  height?: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (result: ChatAttachCameraResult) => void;
};

export function ChatAttachCameraSheet({ visible, onClose, onCapture }: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const close = useCallback(() => {
    void HapticFeedback.selection();
    onClose();
  }, [onClose]);

  const flip = useCallback(() => {
    void HapticFeedback.impactLight();
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, []);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (permission?.granted) return true;
    const next = await requestPermission();
    if (!next.granted) {
      legacyAlert('אישור נדרש', 'אנא אשר גישה למצלמה');
      return false;
    }
    return true;
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    if (!visible) return;
    void ensurePermission();
  }, [ensurePermission, visible]);

  const takePhoto = useCallback(async () => {
    if (capturing) return;
    const ok = await ensurePermission();
    if (!ok || !cameraRef.current) return;
    setCapturing(true);
    void HapticFeedback.impactMedium();
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: Platform.OS === 'android',
        ...(Platform.OS === 'ios' ? { shutterSound: true } : {}),
      });
      if (!photo?.uri) return;
      onCapture({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
      });
      onClose();
    } catch {
      legacyAlert('שגיאה', 'לא הצלחנו לצלם תמונה');
    } finally {
      setCapturing(false);
    }
  }, [capturing, ensurePermission, onCapture, onClose]);

  if (!visible) return null;

  const granted = permission?.granted === true;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={styles.root}>
        {granted ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="picture"
            animateShutter={false}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.permissionFallback]}>
            <Ionicons name="camera-outline" size={56} color={tokens.colors.text.tertiary} />
            <Text style={[styles.permissionText, { color: tokens.colors.text.secondary }]}>
              נדרשת הרשאה למצלמה
            </Text>
            <Pressable
              onPress={() => void ensurePermission()}
              style={[styles.permissionBtn, chromeSurfaceCardStyle(tokens)]}
              accessibilityRole="button"
              accessibilityLabel="אפשר גישה למצלמה"
            >
              <Text style={[styles.permissionBtnLabel, { color: tokens.colors.text.primary }]}>
                אפשר מצלמה
              </Text>
            </Pressable>
          </View>
        )}

        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'transparent']}
          style={[styles.vignetteTop, { paddingTop: insets.top + 8 }]}
          pointerEvents="box-none"
        >
          <View style={styles.topBar}>
            <DayNavBlurButton size={44} onPress={close} accessibilityLabel="סגור">
              <Ionicons name="close" size={22} color={tokens.colors.text.primary} />
            </DayNavBlurButton>
            <Text style={styles.title}>צילום</Text>
            <DayNavBlurButton size={44} onPress={flip} accessibilityLabel="החלף מצלמה">
              <Ionicons name="camera-reverse-outline" size={22} color={tokens.colors.text.primary} />
            </DayNavBlurButton>
          </View>
        </LinearGradient>

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={[styles.vignetteBottom, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => void takePhoto()}
            disabled={!granted || capturing}
            style={({ pressed }) => [
              styles.shutterOuter,
              pressed && { opacity: 0.88 },
              (!granted || capturing) && { opacity: 0.45 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="צלם תמונה"
          >
            {capturing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>
          <Text style={styles.hint}>הקש לצילום</Text>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  permissionText: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.body.fontSize,
    textAlign: 'center',
  },
  permissionBtn: {
    marginTop: 8,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  permissionBtnLabel: {
    fontSize: APP_TYPE.body.fontSize,
    fontWeight: '700',
  },
  vignetteTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 16,
  },
  topBar: {
    direction: 'rtl',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...appPhysicalRightText,
    color: '#fff',
    fontSize: APP_TYPE.sectionTitle.fontSize,
    fontWeight: '700',
  },
  vignetteBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: 28,
    gap: 10,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  hint: {
    ...appPhysicalRightText,
    color: 'rgba(255,255,255,0.72)',
    fontSize: APP_TYPE.sectionSubtitle.fontSize,
    fontWeight: '600',
  },
});
