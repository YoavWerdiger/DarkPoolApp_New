import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { APP_TYPE } from '../ui/appType';
import { SlidingPillGroup } from '../ui/DayDividerPill';
import { useDesignTokens } from '../ui/DesignTokens';
import { UserNameRow } from '../ui/badges/UserBadges';
import { STORY_SCREEN_HEIGHT as H } from './storyLayout';

/* ── Viewers / reactions sheet (inline, no nested Modal) ── */
type ViewersSheetProps = {
  insetsBottom: number;
  insetsTop: number;
  loading: boolean;
  viewers: Array<{
    story_id: string;
    viewer_id: string;
    viewed_at: string;
    emoji?: string | null;
    user: { id: string; display_name: string | null; full_name: string | null; profile_picture: string | null };
  }>;
  reactions: Array<{
    id: string;
    story_id: string;
    reactor_id: string;
    emoji: string;
    created_at: string;
    updated_at: string;
    user: { id: string; display_name: string | null; full_name: string | null; profile_picture: string | null };
  }>;
  tab: 'viewers' | 'reactions';
  onChangeTab: (tab: 'viewers' | 'reactions') => void;
  onClose: () => void;
};

export function StoryViewersSheet({
  insetsBottom,
  insetsTop,
  loading,
  viewers,
  reactions,
  tab,
  onChangeTab,
  onClose,
}: ViewersSheetProps) {
  // לפי הטופו ולערכת הנושא — כמו שאר השיטים (לא בלור כהה עם צבעים קבועים)
  const tokens = useDesignTokens();
  const SHEET_HEIGHT = Math.max(H * 0.6, 420);
  const MAX_TRANSLATE = SHEET_HEIGHT;

  const translateY = useSharedValue(MAX_TRANSLATE);
  const startY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.6 });
    opacity.value = withTiming(1, { duration: 220 });
  }, []);

  const handleClose = useCallback(() => {
    opacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(MAX_TRANSLATE, { duration: 220 }, (finished) => {
      'worklet';
      if (finished) runOnJS(onClose)();
    });
  }, [onClose, MAX_TRANSLATE]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([12, 9999])
    .failOffsetX([-24, 24])
    .onStart(() => {
      'worklet';
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      'worklet';
      const y = Math.max(0, startY.value + e.translationY);
      translateY.value = y;
    })
    .onEnd((e) => {
      'worklet';
      const shouldClose = translateY.value > MAX_TRANSLATE * 0.28 || e.velocityY > 900;
      if (shouldClose) {
        translateY.value = withTiming(MAX_TRANSLATE, { duration: 200 }, (finished) => {
          'worklet';
          if (finished) runOnJS(onClose)();
        });
        opacity.value = withTiming(0, { duration: 200 });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.6 });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value * 0.7 }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const displayName = (u?: { display_name: string | null; full_name: string | null } | null) =>
    u?.display_name || u?.full_name || 'משתמש';

  const listData = tab === 'viewers' ? viewers : reactions;

  return (
    <View style={sheetStyles.root} pointerEvents="box-none">
      <Reanimated.View style={[sheetStyles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Reanimated.View>

      <GestureDetector gesture={panGesture}>
        <Reanimated.View
          style={[
            sheetStyles.sheet,
            {
              height: SHEET_HEIGHT,
              top: H - SHEET_HEIGHT,
              backgroundColor: tokens.colors.background.primary,
              borderTopLeftRadius: tokens.borderRadius.xl,
              borderTopRightRadius: tokens.borderRadius.xl,
            },
            sheetStyle,
          ]}
        >
          {/* Grabber — כמו ידית השיטים באפליקציה */}
          <View style={sheetStyles.grabberWrap} pointerEvents="none">
            <View style={[sheetStyles.grabber, { backgroundColor: tokens.colors.text.secondary }]} />
          </View>

          {/* טאבים — צ'יפי הטופו עם המחוון המחליק */}
          <SlidingPillGroup
            options={[
              { id: 'viewers' as const, label: `צפיות${viewers.length ? ` · ${viewers.length}` : ''}` },
              { id: 'reactions' as const, label: `ריאקציות${reactions.length ? ` · ${reactions.length}` : ''}` },
            ]}
            value={tab}
            onChange={onChangeTab}
            style={sheetStyles.tabsRow}
          />

          {/* List / states */}
          {loading ? (
            <View style={sheetStyles.center}>
              <ActivityIndicator color={tokens.colors.primary.main} />
            </View>
          ) : listData.length === 0 ? (
            <View style={sheetStyles.center}>
              <Ionicons
                name={tab === 'viewers' ? 'eye-off-outline' : 'heart-outline'}
                size={40}
                color={tokens.colors.text.tertiary}
              />
              <Text style={[sheetStyles.emptyText, { color: tokens.colors.text.secondary }]}>
                {tab === 'viewers' ? 'עדיין אף אחד לא צפה' : 'עדיין אין ריאקציות'}
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {listData.map((row: any, idx) => {
                const emoji = tab === 'viewers' ? row.emoji : row.emoji;
                return (
                  <View key={`${row.viewer_id || row.reactor_id}-${idx}`} style={sheetStyles.row}>
                    {emoji ? <Text style={sheetStyles.rowEmoji}>{emoji}</Text> : null}
                    <View style={{ flex: 1 }}>
                      <UserNameRow userId={row.viewer_id || row.reactor_id || row.user?.id}>
                        <Text style={[sheetStyles.rowName, { flexShrink: 1, color: tokens.colors.text.primary }]} numberOfLines={1}>{displayName(row.user)}</Text>
                      </UserNameRow>
                    </View>
                    {row.user.profile_picture ? (
                      <Image source={{ uri: row.user.profile_picture }} style={sheetStyles.avatar} />
                    ) : (
                      <View style={[sheetStyles.avatar, sheetStyles.avatarPlaceholder, { backgroundColor: tokens.colors.background.cardSolid }]}>
                        <Ionicons name="person" size={18} color={tokens.colors.text.secondary} />
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={{ height: insetsBottom + 12 }} />
            </View>
          )}
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  sheetTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10,14,10,0.82)',
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  tabsRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  tabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowName: {
    fontSize: APP_TYPE.cardTitle.fontSize,
    lineHeight: APP_TYPE.cardTitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    textAlign: 'right',
  },
  rowEmoji: {
    fontSize: 22,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  emptyText: {
    fontSize: APP_TYPE.cardBody.fontSize,
    lineHeight: APP_TYPE.cardBody.lineHeight,
  },
});
