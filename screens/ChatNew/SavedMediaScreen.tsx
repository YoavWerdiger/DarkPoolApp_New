// ============================================
// Saved Media Screen - Media saved from group
// ============================================

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChat } from '../../context/ChatContext';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { getChatMediaDisplayUri } from '../../services/chat/chatSignedMediaUrl';
import { ChatScreenShell, ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';

export default function SavedMediaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const DesignTokens = useDesignTokens();
  useLockParentDrawerWhileFocused();
  const { groupId } = route.params as { groupId: string };
  const { messages } = useChat();

  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: string } | null>(null);
  const videoRef = useRef<Video>(null);

  const handleCloseModal = useCallback(async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.stopAsync();
        await videoRef.current.unloadAsync();
      } catch {}
    }
    setSelectedMedia(null);
  }, []);

  // Extract saved media (images and videos) from group messages
  // In a real app, this would filter by messages that user "saved"
  const savedMedia = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    
    return messages
      .filter(msg => 
        msg.group_id === groupId && 
        msg.media_url && 
        (msg.message_type === 'image' || msg.message_type === 'video')
      )
      .map(msg => ({
        id: msg.id,
        url: msg.media_url!,
        thumbnail: msg.media_thumbnail_url || msg.media_url!,
        type: msg.message_type,
        senderName: (msg.sender as any)?.display_name || 'משתמש',
        createdAt: msg.created_at,
      }));
  }, [messages, groupId]);

  const [signedThumbs, setSignedThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const item of savedMedia) {
        const t = await getChatMediaDisplayUri(item.thumbnail);
        next[item.id] = t || item.thumbnail;
      }
      if (!cancelled) setSignedThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [savedMedia]);

  const styles = useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const handleBack = () => {
    navigation.goBack();
  };

  const handleMediaPress = async (item: typeof savedMedia[0]) => {
    const full = (await getChatMediaDisplayUri(item.url)) || item.url;
    setSelectedMedia({ url: full, type: item.type });
  };

  const renderMediaItem = ({ item }: { item: typeof savedMedia[0] }) => (
    <TouchableOpacity
      style={styles.mediaItem}
      onPress={() => handleMediaPress(item)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: signedThumbs[item.id] || item.thumbnail }} style={styles.mediaImage} />
      {item.type === 'video' && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={16} color="#FFFFFF" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ChatScreenShell>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ChatSubScreenHeader title="מדיה שמורה" onBack={handleBack} />

        {/* Media Grid */}
        {savedMedia.length > 0 ? (
          <FlatList
            data={savedMedia}
            renderItem={renderMediaItem}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={64} color={DesignTokens.colors.text.tertiary} />
            <Text style={styles.emptyText}>אין מדיה שמורה</Text>
            <Text style={styles.emptySubtext}>המדיה שתתחיל לשמור תופיע כאן</Text>
          </View>
        )}

        {/* Media Preview Modal */}
        <Modal
          visible={selectedMedia !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCloseModal}
        >
          <View style={styles.modalContainer}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={handleCloseModal}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            {selectedMedia && selectedMedia.type === 'video' ? (
              <Video
                ref={videoRef}
                source={{ uri: selectedMedia.url }}
                style={styles.modalImage}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay
              />
            ) : selectedMedia ? (
              <Image
                source={{ uri: selectedMedia.url }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </Modal>
      </SafeAreaView>
    </ChatScreenShell>
  );
}

const createStyles = (DesignTokens: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContainer: {
    padding: DesignTokens.spacing.lg,
    gap: DesignTokens.spacing.xs,
  },
  mediaItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: DesignTokens.borderRadius.md,
    overflow: 'hidden',
    marginHorizontal: '1%',
    marginBottom: DesignTokens.spacing.xs,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    top: DesignTokens.spacing.xs,
    right: DesignTokens.spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: DesignTokens.borderRadius.sm,
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.spacing.xl,
  },
  emptyText: {
    fontSize: DesignTokens.typography.fontSize.lg,
    fontWeight: DesignTokens.typography.fontWeight.semibold as any,
    color: DesignTokens.colors.text.primary,
    marginTop: DesignTokens.spacing.lg,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: DesignTokens.typography.fontSize.sm,
    color: DesignTokens.colors.text.tertiary,
    marginTop: DesignTokens.spacing.sm,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    padding: DesignTokens.spacing.sm,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
});


