// ============================================
// Add Member Sheet
// ============================================
// חיפוש ובחירת משתמשים להוספה לקבוצה
// ============================================

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { searchUsers } from '../../services/chat/chatSearchService';
import { BlurView } from 'expo-blur';
import { HapticFeedback } from '../../utils/hapticFeedback';

interface User {
  id: string;
  display_name: string | null;
  full_name: string | null;
  profile_picture: string | null;
  is_online?: boolean;
}

interface AddMemberSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (userId: string, displayName: string) => Promise<void>;
  existingMemberIds?: string[];
}

export default function AddMemberSheet({
  visible,
  onClose,
  onAdd,
  existingMemberIds = [],
}: AddMemberSheetProps) {
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      const { data } = await searchUsers(text.trim(), existingMemberIds, 20);
      setResults(data || []);
      setIsSearching(false);
    }, 350);
  }, [existingMemberIds]);

  const handleAdd = async (user: User) => {
    void HapticFeedback.impactLight();
    setAddingId(user.id);
    const name = user.display_name || user.full_name || 'משתמש';
    await onAdd(user.id, name);
    setAddingId(null);
    setResults(prev => prev.filter(u => u.id !== user.id));
  };

  const handleClose = () => {
    void HapticFeedback.impactLight();
    setQuery('');
    setResults([]);
    onClose();
  };

  const renderUser = ({ item }: { item: User }) => {
    const name = item.display_name || item.full_name || 'משתמש';
    const isAdding = addingId === item.id;
    return (
      <View style={[styles.userRow, { borderBottomColor: DesignTokens.colors.border.subtle ?? DesignTokens.colors.border.primary }]}>
        <View style={styles.userLeft}>
          {item.profile_picture ? (
            <Image source={{ uri: item.profile_picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: DesignTokens.colors.background.tertiary }]}>
              <Text style={[styles.avatarInitial, { color: DesignTokens.colors.text.secondary }]}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {item.is_online && (
            <View style={[styles.onlineDot, { backgroundColor: DesignTokens.colors.text.success ?? '#4CAF50', borderColor: DesignTokens.colors.background.secondary }]} />
          )}
        </View>
        <Text style={[styles.userName, { color: DesignTokens.colors.text.primary }]} numberOfLines={1}>
          {name}
        </Text>
        <TouchableOpacity
          onPress={() => handleAdd(item)}
          disabled={isAdding}
          style={[styles.addBtn, { backgroundColor: DesignTokens.colors.primary.main }]}
          activeOpacity={0.75}
        >
          {isAdding ? (
            <ActivityIndicator size={14} color="#fff" />
          ) : (
            <Ionicons name="add" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: DesignTokens.colors.background.secondary,
              borderColor: DesignTokens.colors.border.primary,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: DesignTokens.colors.border.primary }]} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={DesignTokens.colors.text.secondary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: DesignTokens.colors.text.primary }]}>
              הוסף חברים
            </Text>
            <View style={{ width: 22 }} />
          </View>

          {/* Search input */}
          <View style={[styles.searchContainer, { backgroundColor: DesignTokens.colors.background.tertiary, borderColor: DesignTokens.colors.border.primary }]}>
            <Ionicons name="search" size={16} color={DesignTokens.colors.text.tertiary} style={styles.searchIcon} />
            <TextInput
              value={query}
              onChangeText={handleQueryChange}
              placeholder="חפש לפי שם..."
              placeholderTextColor={DesignTokens.colors.text.tertiary}
              style={[styles.searchInput, { color: DesignTokens.colors.text.primary }]}
              autoFocus
              textAlign="right"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  void HapticFeedback.selection();
                  handleQueryChange('');
                }}
              >
                <Ionicons name="close-circle" size={16} color={DesignTokens.colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results */}
          {isSearching ? (
            <ActivityIndicator
              size="large"
              color={DesignTokens.colors.primary.main}
              style={{ marginTop: 32 }}
            />
          ) : results.length === 0 && query.trim().length > 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="person-outline" size={40} color={DesignTokens.colors.text.tertiary} />
              <Text style={[styles.emptyText, { color: DesignTokens.colors.text.tertiary }]}>
                לא נמצאו משתמשים
              </Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color={DesignTokens.colors.text.tertiary} />
              <Text style={[styles.emptyText, { color: DesignTokens.colors.text.tertiary }]}>
                הקלד שם לחיפוש
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              renderItem={renderUser}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 8 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    minHeight: 380,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontSize: 15,
    textAlign: 'right',
    padding: 0,
  },
  userRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  userLeft: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    left: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  userName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
