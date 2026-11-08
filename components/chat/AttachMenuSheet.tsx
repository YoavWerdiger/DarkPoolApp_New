import { ROOT_DIR, UI_DIR, dirIcon } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
/**
 * שיט צירוף (QA 4.2) — כמו בוואטסאפ: שורת תמונות אחרונות מהגלריה, ומתחת גריד של פעולות
 * עם עיגולים צבעוניים: גלריה · מצלמה · מסמך · סקר · מיקום · איש קשר · אירוע.
 * בלי «אודיו» — יש כפתור מיקרופון בשורת הכתיבה.
 * כל פעולה רצה אחרי שהשיט נסגר (ב-iOS מצלמה / בורר מערכת מעל שיט פתוח נתקעים).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CalendarDays,
  Camera,
  ChartColumnBig,
  FileText,
  Image as ImageIcon,
  MapPin,
  UserRound,
} from 'lucide-react-native';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE, headerExitButtonFill } from '../ui/DayNavBlurButton';
import { useDesignTokens } from '../ui/DesignTokens';
import { peekMediaRecents, prefetchMediaRecents, type MediaRecentAsset } from '../../lib/mediaRecentsCache';
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
  onPoll?: () => void;
  onLocation?: () => void;
  onContact?: () => void;
  onEvent?: () => void;
  /** תמונה/סרטון מהשורה העליונה — ישר לפריוויו */
  onPickRecent?: (asset: MediaRecentAsset) => void;
};

/** צבעי העיגולים — כל פעולה בצבע משלה, כמו בוואטסאפ */
const ACTION_COLORS = {
  gallery: '#5B6CFF',
  camera: '#E5487D',
  document: '#7E5BEF',
  poll: '#E8A317',
  location: '#1FA855',
  contact: '#0EA5E9',
  event: '#E5484D',
} as const;

const RECENT_THUMB = 76;

export default function AttachMenuSheet({
  visible,
  onClose,
  onCamera,
  onGallery,
  onDocument,
  onPoll,
  onLocation,
  onContact,
  onEvent,
  onPickRecent,
}: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(), []);
  const { snapPoint, onContentLayout } = useChatFitContentSnap(0.35, 0.8, 0.12);

  // תמונות אחרונות — רק אם כבר יש הרשאה (לא מבקשים הרשאה רק בשביל השורה)
  const [recents, setRecents] = useState<MediaRecentAsset[]>(() => peekMediaRecents('all')?.assets ?? []);
  useEffect(() => {
    if (!visible || !onPickRecent) return;
    let cancelled = false;
    void prefetchMediaRecents('all').then((page) => {
      if (!cancelled && page?.assets?.length) setRecents(page.assets);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, onPickRecent]);

  const actions = [
    onGallery ? { key: 'gallery', title: i18n.t('auto.components__chat__AttachMenuSheet.s2'), icon: ImageIcon, color: ACTION_COLORS.gallery, run: onGallery } : null,
    onCamera ? { key: 'camera', title: i18n.t('auto.components__chat__AttachMenuSheet.s1'), icon: Camera, color: ACTION_COLORS.camera, run: onCamera } : null,
    onDocument ? { key: 'document', title: i18n.t('auto.components__chat__AttachMenuSheet.s3'), icon: FileText, color: ACTION_COLORS.document, run: onDocument } : null,
    onPoll ? { key: 'poll', title: i18n.t('auto.components__chat__AttachMenuSheet.s5'), icon: ChartColumnBig, color: ACTION_COLORS.poll, run: onPoll } : null,
    onLocation ? { key: 'location', title: i18n.t('auto.components__chat__AttachMenuSheet.s8'), icon: MapPin, color: ACTION_COLORS.location, run: onLocation } : null,
    onContact ? { key: 'contact', title: i18n.t('auto.components__chat__AttachMenuSheet.s9'), icon: UserRound, color: ACTION_COLORS.contact, run: onContact } : null,
    onEvent ? { key: 'event', title: i18n.t('auto.components__chat__AttachMenuSheet.s10'), icon: CalendarDays, color: ACTION_COLORS.event, run: onEvent } : null,
  ].filter(Boolean) as Array<{ key: string; title: string; icon: typeof Camera; color: string; run: () => void }>;

  const runAction = (run: () => void) => {
    void HapticFeedback.selection();
    onClose();
    runAfterSheetDismiss(run);
  };


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
            <Text style={[styles.headerTitle, { color: tokens.colors.text.primary }]}>{i18n.t('auto.components__chat__AttachMenuSheet.s6')}</Text>
          </View>
          <View style={styles.headerSideSpacer} />
        </View>


        {onPickRecent && recents.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentsRow}
            style={styles.recents}
            accessibilityLabel={i18n.t('auto.components__chat__AttachMenuSheet.s11')}
          >
            {recents.slice(0, 20).map((asset) => (
              <Pressable
                key={asset.id}
                onPress={() => runAction(() => onPickRecent(asset))}
                style={[styles.recentThumb, { backgroundColor: tokens.colors.background.tertiary }]}
              >
                <ExpoImage
                  source={{ uri: asset.uri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={asset.id}
                />
                {asset.mediaType === 'video' ? (
                  <View style={styles.recentVideoBadge}>
                    <Ionicons name="play" size={11} color="#FFFFFF" />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.grid}>
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Pressable
                key={a.key}
                style={styles.gridItem}
                onPress={() => runAction(a.run)}
                accessibilityRole="button"
                accessibilityLabel={a.title}
              >
                <View style={[styles.gridCircle, { backgroundColor: a.color }]}>
                  <Icon size={24} color="#FFFFFF" strokeWidth={1.9} />
                </View>
                <Text style={[styles.gridLabel, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                  {a.title}
                </Text>
              </Pressable>
            );
          })}
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
      accessibilityLabel={i18n.t('auto.components__chat__AttachMenuSheet.s7')}
    >
      <Ionicons name={dirIcon('chevron-forward')} size={22} color={tokens.colors.text.primary} />
    </DayNavBlurButton>
  );
}

function createStyles() {
  return StyleSheet.create({
    container: { direction: UI_DIR },
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
      direction: ROOT_DIR,
      textAlign: 'center',
      writingDirection: TEXT_DIR,
      width: '100%',
    },
    recents: {
      marginTop: APP_LAYOUT.cardTitleToBodyGap + 4,
      flexGrow: 0,
    },
    recentsRow: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      gap: 8,
    },
    recentThumb: {
      width: RECENT_THUMB,
      height: RECENT_THUMB,
      borderRadius: 12,
      overflow: 'hidden',
    },
    recentVideoBadge: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    // 4 בשורה; שורה אחרונה חלקית מיושרת להתחלה (כמו בוואטסאפ)
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal - 4,
      marginTop: 20,
      rowGap: 20,
    },
    gridItem: {
      width: '25%',
      alignItems: 'center',
      gap: 8,
    },
    gridCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridLabel: {
      fontSize: 13,
      lineHeight: 16,
      fontWeight: '500',
      textAlign: 'center',
      writingDirection: TEXT_DIR,
    },
  });
}
