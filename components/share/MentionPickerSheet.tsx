import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT } from '../ui/appLayout';
import { APP_TYPE } from '../ui/appType';
import { formFieldShellStyle } from '../ui/formControl';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { useAuth } from '../../context/AuthContext';
import { searchUsers } from '../../services/chat/chatSearchService';
import { supabase } from '../../services/supabase';
import type { CommunityMention } from '../../types/tweets.types';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (mention: CommunityMention) => void;
  excludeUserIds?: string[];
};

type UserRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  profile_picture: string | null;
};

let lastMentionSuggestions: UserRow[] = [];

function displayNameOf(u: UserRow): string {
  return (u.display_name || u.full_name || 'משתמש').trim() || 'משתמש';
}

export default function MentionPickerSheet({
  visible,
  onClose,
  onSelect,
  excludeUserIds = [],
}: Props) {
  const tokens = useDesignTokens();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const excluded = useMemo(() => {
    const ids = [...excludeUserIds];
    if (user?.id) ids.push(user.id);
    return ids;
  }, [excludeUserIds, user?.id]);

  const loadSuggestions = useCallback(async () => {
    if (lastMentionSuggestions.length === 0) setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from('v_public_profiles')
        .select('id, display_name, full_name, profile_picture')
        .order('display_name', { ascending: true })
        .limit(30);
      const validExclude = excluded.filter((id) =>
        /^[0-9a-f-]{36}$/i.test(id)
      );
      if (validExclude.length > 0) {
        q = q.not('id', 'in', `(${validExclude.join(',')})`);
      }
      const { data, error: qErr } = await q;
      if (qErr) throw qErr;
      const rows = (data ?? []) as UserRow[];
      lastMentionSuggestions = rows;
      setResults(rows);
    } catch (e: any) {
      setResults([]);
      setError(e?.message || 'לא ניתן לטעון חברי קהילה');
    } finally {
      setLoading(false);
    }
  }, [excluded]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setError(null);
      setLoading(false);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      return;
    }
    if (lastMentionSuggestions.length > 0) {
      setResults(lastMentionSuggestions);
      setLoading(false);
    }
    void loadSuggestions();
  }, [visible, loadSuggestions]);

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      const trimmed = text.trim();
      if (!trimmed) {
        void loadSuggestions();
        return;
      }
      searchTimeout.current = setTimeout(async () => {
        setLoading(true);
        setError(null);
        const { data, error: sErr } = await searchUsers(trimmed, excluded, 25);
        if (sErr) {
          setResults([]);
          setError(sErr.message || 'חיפוש נכשל');
        } else {
          setResults((data ?? []) as UserRow[]);
        }
        setLoading(false);
      }, 320);
    },
    [excluded, loadSuggestions]
  );

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.72]}
      enablePanDownToClose
      edgeToEdge
      showHandle
      showBrandBackground={false}
      showBrandWatermark={false}
      contentPaddingBottom={0}
      topCornerRadius={28}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <DayNavBlurButton
            onPress={onClose}
            size={DAY_NAV_BUTTON_SIZE}
            glassIntensity="subtle"
            style={styles.headerIconButton}
            accessibilityLabel="סגור"
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={tokens.colors.text.primary}
            />
          </DayNavBlurButton>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: tokens.colors.text.primary }]}>
              תיוג חבר
            </Text>
          </View>
          <View style={styles.headerSideSpacer} />
        </View>

        <View
          style={[
            formFieldShellStyle({ tokens, focused: false }),
            styles.searchWrap,
          ]}
        >
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder="חיפוש לפי שם…"
            placeholderTextColor={tokens.colors.text.tertiary}
            style={[styles.searchInput, { color: tokens.colors.text.primary }]}
            textAlign="right"
            autoCorrect={false}
            autoCapitalize="none"
          />
          <Ionicons name="search" size={18} color={tokens.colors.text.tertiary} />
        </View>

        {loading && results.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.text.secondary} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={[styles.empty, { color: tokens.colors.text.secondary }]}>
              {error}
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              results.length === 0 ? styles.listEmpty : styles.listContent
            }
            ListEmptyComponent={
              <Text style={[styles.empty, { color: tokens.colors.text.tertiary }]}>
                לא נמצאו חברים
              </Text>
            }
            renderItem={({ item }) => {
              const name = displayNameOf(item);
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    void HapticFeedback.medium();
                    onSelect({ userId: item.id, displayName: name });
                    onClose();
                  }}
                >
                  {item.profile_picture ? (
                    <Image
                      source={{ uri: item.profile_picture }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarLetter}>
                        {(name[0] || '?').toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowText}>
                    <Text
                      style={[styles.rowTitle, { color: tokens.colors.text.primary }]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    <Text
                      style={[styles.rowSub, { color: tokens.colors.text.tertiary }]}
                      numberOfLines={1}
                    >
                      @{name.replace(/\s+/g, '')}
                    </Text>
                  </View>
                  <Ionicons
                    name="at"
                    size={20}
                    color={tokens.colors.text.tertiary}
                  />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </BottomSheet>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    container: { flex: 1, minHeight: 0, direction: 'ltr' },
    header: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingBottom: APP_LAYOUT.cardTitleToBodyGap,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
      gap: 10,
      flexShrink: 0,
    },
    headerIconButton: {
      alignSelf: 'center',
      backgroundColor: tokens.colors.background.primary,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSideSpacer: {
      width: DAY_NAV_BUTTON_SIZE,
      height: DAY_NAV_BUTTON_SIZE,
    },
    headerTitle: {
      ...APP_TYPE.screenTitle,
      textAlign: 'center',
      writingDirection: 'rtl',
      width: '100%',
    },
    searchWrap: {
      flexDirection: 'row-reverse',
      marginHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      marginTop: APP_LAYOUT.cardPadding,
      marginBottom: APP_LAYOUT.cardStackGap,
      paddingHorizontal: 16,
      minHeight: 52,
      borderRadius: 999,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      ...APP_TYPE.body,
      padding: 0,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: APP_LAYOUT.screenPaddingHorizontal,
    },
    listContent: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingBottom: 28,
    },
    listEmpty: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 28,
    },
    empty: {
      ...APP_TYPE.cardSubtitle,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 15,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: tokens.borderRadius.full,
    },
    avatarFallback: {
      backgroundColor: tokens.colors.background.tertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLetter: {
      ...APP_TYPE.cardTitle,
      color: tokens.colors.text.primary,
    },
    rowText: { flex: 1, minWidth: 0, gap: APP_LAYOUT.cardTitleToSubtitleGap },
    rowTitle: {
      ...APP_TYPE.cardTitle,
      textAlign: 'right',
      writingDirection: 'rtl',
      color: tokens.colors.text.primary,
    },
    rowSub: {
      ...APP_TYPE.cardSubtitle,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
}
