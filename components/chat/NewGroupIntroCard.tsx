import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
import { appLocale } from '../../lib/i18n/locale';
/**
 * כרטיס פתיחה לקבוצה בלי הודעות (QA 7.2) — כמו בוואטסאפ:
 * תמונה + שם, «נוצרה על ידי X · תאריך», מספר חברים, תיאור / «הוספת תיאור…» ופעולות.
 */
import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { useTheme } from '../../context/ThemeContext';
import { groupAvatarSource } from '../../assets/chatGroups/groupChatIcons';
import UIButton from '../ui/UIButton';

const AVATAR = 76;

type Props = {
  name: string;
  avatarUrl?: string | null;
  creatorName?: string | null;
  createdAt?: string | null;
  membersCount?: number | null;
  description?: string | null;
  canManage: boolean;
  onAddMembers?: () => void;
  onOpenInfo: () => void;
};

export function NewGroupIntroCard({
  name,
  avatarUrl,
  creatorName,
  createdAt,
  membersCount,
  description,
  canManage,
  onAddMembers,
  onOpenInfo,
}: Props) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const avatar = groupAvatarSource(name, avatarUrl, isDarkMode);

  const createdLine = useMemo(() => {
    const date = createdAt
      ? new Date(createdAt).toLocaleDateString(appLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
      : null;
    const who = creatorName
      ? i18n.t('auto.components__chat__NewGroupIntroCard.s1', { v0: creatorName })
      : i18n.t('auto.components__chat__NewGroupIntroCard.s2');
    return date ? `${who} · ${date}` : who;
  }, [createdAt, creatorName]);

  const desc = description?.trim();

  return (
    <View style={styles.card}>
      <View style={styles.avatarWrap}>
        {avatar ? (
          <Image source={avatar} style={styles.avatar} resizeMode="cover" />
        ) : (
          <Ionicons name="people" size={34} color={tokens.colors.text.secondary} />
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>{name}</Text>
      <Text style={styles.meta}>{createdLine}</Text>
      {membersCount != null && membersCount > 0 ? (
        <Text style={styles.meta}>{i18n.t('auto.components__chat__NewGroupIntroCard.s3', { v0: membersCount })}</Text>
      ) : null}

      {desc ? (
        <Text style={styles.description} numberOfLines={4}>{desc}</Text>
      ) : canManage ? (
        <Pressable onPress={onOpenInfo} hitSlop={8} accessibilityRole="button">
          <Text style={styles.addDescription}>{i18n.t('auto.components__chat__NewGroupIntroCard.s4')}</Text>
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        {canManage && onAddMembers ? (
          <UIButton
            title={i18n.t('auto.components__chat__NewGroupIntroCard.s5')}
            icon="person-add-outline"
            variant="primary"
            size="md"
            onPress={onAddMembers}
          />
        ) : null}
        <UIButton
          title={i18n.t('auto.components__chat__NewGroupIntroCard.s6')}
          icon="information-circle-outline"
          variant="secondary"
          size="md"
          onPress={onOpenInfo}
        />
      </View>
    </View>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    card: {
      alignSelf: 'center',
      width: '86%',
      maxWidth: 360,
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 20,
      borderRadius: 20,
      backgroundColor: tokens.colors.background.cardSolid,
      gap: 4,
    },
    avatarWrap: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.colors.background.tertiary,
      marginBottom: 8,
    },
    avatar: { width: AVATAR, height: AVATAR },
    name: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '600',
      color: tokens.colors.text.primary,
      textAlign: 'center',
      writingDirection: TEXT_DIR,
    },
    meta: {
      fontSize: 13,
      lineHeight: 18,
      color: tokens.colors.text.secondary,
      textAlign: 'center',
      writingDirection: TEXT_DIR,
    },
    description: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: tokens.colors.text.primary,
      textAlign: 'center',
      writingDirection: TEXT_DIR,
    },
    addDescription: {
      marginTop: 8,
      fontSize: 14,
      fontWeight: '500',
      color: tokens.colors.primary.main,
      textAlign: 'center',
    },
    actions: {
      marginTop: 16,
      alignSelf: 'stretch',
      gap: 8,
    },
  });
}
