/**
 * שיט צירוף לפי הטופו — כמו שאר השיטים שלנו (שיתוף, 3 הנקודות ביומן):
 * BottomSheet בגובה התוכן, כותרת עם שברון, וכרטיס עם שורות פעולה:
 * צילום · גלריה · מסמך · אודיו · סקר.
 * כל פעולה רצה אחרי שהשיט נסגר (ב-iOS מצלמה / בורר מערכת מעל שיט פתוח נתקעים).
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, ChartColumnBig, FileText, Image as ImageIcon, Mic } from 'lucide-react-native';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE, headerExitButtonFill } from '../ui/DayNavBlurButton';
import { SettingsActionRow, SettingsGlassCard } from '../profile/ProfileSettingsUI';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT } from '../ui/appLayout';
import { APP_TYPE } from '../ui/appType';
import { useChatFitContentSnap, useChatSheetDismiss } from './ChatBottomSheet';
import { runAfterSheetDismiss } from './mediaPickerLaunch';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCamera?: () => void;
  onGallery?: () => void;
  onDocument?: () => void;
  onAudio?: () => void;
  onPoll?: () => void;
};

export default function AttachMenuSheet({
  visible,
  onClose,
  onCamera,
  onGallery,
  onDocument,
  onAudio,
  onPoll,
}: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(), []);
  const { snapPoint, onContentLayout } = useChatFitContentSnap(0.35, 0.8, 0.12);

  const actions = [
    onCamera ? { key: 'camera', title: 'צילום', icon: Camera, run: onCamera } : null,
    onGallery ? { key: 'gallery', title: 'גלריה', icon: ImageIcon, run: onGallery } : null,
    onDocument ? { key: 'document', title: 'מסמך', icon: FileText, run: onDocument } : null,
    onAudio ? { key: 'audio', title: 'אודיו', icon: Mic, run: onAudio } : null,
    onPoll ? { key: 'poll', title: 'סקר', icon: ChartColumnBig, run: onPoll } : null,
  ].filter(Boolean) as Array<{ key: string; title: string; icon: typeof Camera; run: () => void }>;

  const noChevron = <View />;


  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      enablePanDownToClose
      showHandle
      useModal
      showBrandBackground={false}
      showBrandWatermark={false}
      edgeToEdge
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
    >
      <View
        style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}
        onLayout={onContentLayout}
      >
        <View style={styles.header}>
          <HeaderClose onClose={onClose} />
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: tokens.colors.text.primary }]}>צירוף מדיה</Text>
          </View>
          <View style={styles.headerSideSpacer} />
        </View>


        <View style={styles.actions}>
          <SettingsGlassCard style={{ marginBottom: 0 }}>
            {actions.map((a, i) => (
              <SettingsActionRow
                key={a.key}
                title={a.title}
                icon={a.icon}
                trailing={noChevron}
                showDivider={i < actions.length - 1}
                onPress={() => {
                  void HapticFeedback.selection();
                  onClose();
                  runAfterSheetDismiss(a.run);
                }}
              />
            ))}
          </SettingsGlassCard>
        </View>
      </View>
    </BottomSheet>
  );
}

/** שברון סגירה — כמו בשיט השיתוף (סגירה מונפשת מתוך השיט) */
function HeaderClose({ onClose }: { onClose: () => void }) {
  const tokens = useDesignTokens();
  const dismiss = useChatSheetDismiss(onClose);
  return (
    <DayNavBlurButton
      onPress={dismiss}
      size={DAY_NAV_BUTTON_SIZE}
      glass={false}
      style={{ backgroundColor: headerExitButtonFill(tokens.colors.background.cardSolid) }}
      accessibilityLabel="סגור"
    >
      <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
    </DayNavBlurButton>
  );
}

function createStyles() {
  return StyleSheet.create({
    container: { direction: 'rtl' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: 4,
      gap: 10,
    },
    headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    headerSideSpacer: { width: DAY_NAV_BUTTON_SIZE, height: DAY_NAV_BUTTON_SIZE },
    headerTitle: {
      fontSize: APP_TYPE.sectionTitle.fontSize,
      lineHeight: APP_TYPE.sectionTitle.lineHeight,
      fontWeight: APP_TYPE.sectionTitle.fontWeight,
      direction: 'ltr',
      textAlign: 'center',
      writingDirection: 'rtl',
      width: '100%',
    },
    actions: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      marginTop: APP_LAYOUT.cardTitleToBodyGap + 4,
    },
  });
}
