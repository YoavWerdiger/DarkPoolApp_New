// ============================================
// Saved Media Screen - Starred media from group
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useLockParentDrawerWhileFocused } from '../../hooks/useLockParentDrawerWhileFocused';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { getChatMediaDisplayUri } from '../../services/chat/chatSignedMediaUrl';
import { chatMessageService } from '../../services/chat';
import { useAuth } from '../../context/AuthContext';
import { ChatScreenShell, ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { logger } from '../../utils/logger';

interface SavedMediaItem {
  id: string;
  url: string;
  thumbnail: string;
  type: string;
  senderName: string;
  createdAt: string;
}

export default function SavedMediaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  useLockParentDrawerWhileFocused();
  const { groupId } = route.params as { groupId: string };

  const [savedMedia, setSavedMedia] = useState<SavedMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!user?.id) {
        setSavedMedia([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await chatMessageService.getStarredMessages(user.id, groupId, {
          limit: 100,
        });

        if (cancelled) return;

        if (error || !data) {
          setSavedMedia([]);
          return;
        }

        const items: SavedMediaItem[] = data
          .map((row: any) => row.message)
          .filter(
            (msg: any) =>
              msg &&
              msg.media_url &&
              (msg.message_type === 'image' || msg.message_type === 'video')
          )
          .map((msg: any) => ({
            id: msg.id,
            url: msg.media_url,
            thumbnail: msg.media_thumbnail_url || msg.media_url,
            type: msg.message_type,
            senderName: msg.sender?.display_name || 'משתמש',
            createdAt: msg.created_at,
          }));

        setSavedMedia(items);
      } catch (error) {
        logger.error('SavedMediaScreen', 'Failed to load starred media', error);
        if (!cancelled) setSavedMedia([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, groupId]);

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

  const renderItem = ({ item }: { item: SavedMediaItem }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={async () => {
        const signed = await getChatMediaDisplayUri(item.url);
        setSelectedMedia({ url: signed || item.url, type: item.type });
      }}
    >
      <Image
        source={{ uri: signedThumbs[item.id] || item.thumbnail }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      {item.type === 'video' && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ChatScreenShell>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ChatSubScreenHeader title="מדיה שמורה" onBack={() => navigation.goBack()} />

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="small" color={DesignTokens.colors.primary.main} />
            <Text style={styles.emptyText}>טוען מדיה...</Text>
          </View>
        ) : savedMedia.length === 0 ? (
          <View style={styles.centerContent}>
            <Ionicons name="images-outline" size={48} color={DesignTokens.colors.text.secondary} />
            <Text style={styles.emptyTitle}>אין מדיה שמורה</Text>
            <Text style={styles.emptyText}>סמן הודעות עם כוכב כדי לשמור אותן כאן</Text>
          </View>
        ) : (
          <FlatList
            data={savedMedia}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.gridContainer}
          />
        )}

        <Modal visible={!!selectedMedia} transparent animationType="fade" onRequestClose={handleCloseModal}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalClose} onPress={handleCloseModal}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            {selectedMedia?.type === 'video' ? (
              <Video
                ref={videoRef}
                source={{ uri: selectedMedia.url }}
                style={styles.fullMedia}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
              />
            ) : selectedMedia ? (
              <Image source={{ uri: selectedMedia.url }} style={styles.fullMedia} resizeMode="contain" />
            ) : null}
          </View>
        </Modal>
      </SafeAreaView>
    </ChatScreenShell>
  );
}

const createStyles = (tokens: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    emptyTitle: {
      marginTop: 12,
      color: tokens.colors.text.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    emptyText: {
      marginTop: 8,
      color: tokens.colors.text.secondary,
      fontSize: 14,
      textAlign: 'center',
    },
    gridContainer: { padding: 4 },
    gridItem: {
      flex: 1 / 3,
      aspectRatio: 1,
      padding: 2,
      position: 'relative',
    },
    thumbnail: {
      width: '100%',
      height: '100%',
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    videoBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 12,
      padding: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.92)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalClose: {
      position: 'absolute',
      top: 56,
      right: 20,
      zIndex: 10,
      padding: 8,
    },
    fullMedia: {
      width: '100%',
      height: '80%',
    },
  });
