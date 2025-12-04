import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Video as VideoIcon, ImageIcon, Music, FileText, ArrowRight } from 'lucide-react-native';
import { MediaViewer } from '../../components/chat';
import { supabase } from '../../lib/supabase';
import { useDesignTokens } from '../../components/ui/DesignTokens';

const { width: screenWidth } = Dimensions.get('window');
const itemSize = (screenWidth - 60) / 3; // 3 columns with margins

interface MediaItem {
  id: string;
  content: string;
  type: 'image' | 'video' | 'audio' | 'document';
  created_at: string;
  sender_id: string;
  users?: {
    full_name: string;
    profile_picture?: string;
  };
}

export default function MediaGalleryScreen() {
  const DesignTokens = useDesignTokens();
  const route = useRoute();
  const navigation = useNavigation();
  const tabBarInsets = useSafeAreaInsets();
  const { chatId, channelName } = route.params as { chatId: string; channelName: string };

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'media' | 'documents'>('media');
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // הסתר TabBar כשנכנסים למסך זה
  useFocusEffect(
    React.useCallback(() => {
      const parent = (navigation as any).getParent();
      if (parent) {
        parent.setOptions({
          tabBarStyle: { display: 'none' }
        });
      }

      return () => {
        if (parent) {
          parent.setOptions({
            tabBarStyle: {
              backgroundColor: DesignTokens.colors.background.primary,
              borderTopWidth: 0,
              height: Platform.OS === 'ios' ? 90 : 70 + tabBarInsets.bottom,
              paddingBottom: Platform.OS === 'ios' ? 15 : tabBarInsets.bottom + 10,
              paddingTop: 15,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
              display: 'flex'
            }
          });
        }
      };
    }, [navigation, tabBarInsets])
  );

  useEffect(() => {
    loadMediaItems();
  }, [chatId]);

  const loadMediaItems = async () => {
    try {
      console.log('🖼️ Loading media items for gallery:', chatId);

      // Get all media type messages
      const { data: mediaData, error: mediaError } = await supabase
        .from('messages')
        .select(`
          id, 
          content, 
          type, 
          created_at, 
          sender_id,
          file_url,
          users!messages_sender_id_fkey(full_name, profile_picture)
        `)
        .eq('channel_id', chatId)
        .in('type', ['image', 'video', 'audio', 'document'])
        .order('created_at', { ascending: false })
        .limit(200);

      if (mediaError) {
        console.error('❌ Error loading media items:', mediaError);
        return;
      }

      console.log('✅ Media items loaded:', mediaData?.length || 0);

      // Process media items to get proper URLs
      const processedMediaItems = await Promise.all(
        (mediaData || []).map(async (item) => {
          let mediaUrl = item.file_url || item.content;

          // If we have a file_url, use it directly
          if (item.file_url) {
            return {
              ...item,
              content: item.file_url,
              isValid: true
            };
          }

          // Skip invalid content
          if (!item.content ||
            item.content === '[image]' ||
            item.content === '[video]' ||
            item.content === '[audio]' ||
            item.content === '[document]' ||
            item.content.includes('אחאח') ||
            item.content.includes('היידה') ||
            item.content.includes('שלום')) {
            return {
              ...item,
              content: null,
              isValid: false
            };
          }

          // Get signed URL if needed
          if (item.content && !item.content.startsWith('http')) {
            try {
              let bucketName = 'chat-files';
              if (item.type === 'video' || item.type === 'audio' || item.type === 'document') {
                bucketName = 'media';
              }

              const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from(bucketName)
                .createSignedUrl(item.content, 3600);

              if (!signedUrlError) {
                mediaUrl = signedUrlData.signedUrl;
              }
            } catch (error) {
              console.error('❌ Error getting signed URL:', error);
            }
          }

          return {
            ...item,
            content: mediaUrl,
            isValid: true
          };
        })
      );

      // Filter valid items and fix type
      const validItems = processedMediaItems
        .filter(item => item.isValid && item.content)
        .map(item => ({
          id: item.id,
          content: item.content,
          type: item.type,
          created_at: item.created_at,
          sender_id: item.sender_id,
          users: item.users?.[0] ? {
            full_name: item.users[0].full_name,
            profile_picture: item.users[0].profile_picture
          } : undefined
        }));
      setMediaItems(validItems);

    } catch (error) {
      console.error('❌ Exception loading media items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMediaPress = (item: MediaItem) => {
    console.log('🎯 Opening media:', item);
    setSelectedMedia(item);
    setShowMediaViewer(true);
  };

  const handleDownload = async (item: MediaItem) => {
    try {
      console.log('📥 Downloading media:', item.content);
      // TODO: Implement download functionality
      // You can use expo-file-system or expo-sharing for this
    } catch (error) {
      console.error('❌ Error downloading media:', error);
    }
  };

  const handleShare = async (item: MediaItem) => {
    try {
      console.log('📤 Sharing media:', item.content);
      // TODO: Implement share functionality
    } catch (error) {
      console.error('❌ Error sharing media:', error);
    }
  };

  const getMediaItems = () => {
    if (selectedTab === 'media') {
      return mediaItems.filter(item => ['image', 'video', 'audio'].includes(item.type));
    } else {
      return mediaItems.filter(item => item.type === 'document');
    }
  };

  const renderMediaItem = ({ item }: { item: MediaItem }) => {
    const isImage = item.type === 'image';
    const isVideo = item.type === 'video';
    const isAudio = item.type === 'audio';
    const isDocument = item.type === 'document';

    return (
      <TouchableOpacity
        onPress={() => handleMediaPress(item)}
        style={{
          width: itemSize,
          height: itemSize,
          marginBottom: 6,
          marginHorizontal: 3
        }}
      >
        <View style={{
          width: '100%',
          height: '100%',
          backgroundColor: DesignTokens.colors.background.secondary,
          borderRadius: 8,
          overflow: 'hidden',
          position: 'relative'
        }}>
          {isImage && !item.content?.startsWith('placeholder_') && item.content ? (
            <Image
              source={{ uri: item.content }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              onError={(error) => {
                console.error('Image load error in MediaGalleryScreen:', error);
              }}
            />
          ) : isVideo && !item.content?.startsWith('placeholder_') && item.content ? (
            <View style={{ width: '100%', height: '100%', position: 'relative' }}>
              <Image
                source={{ uri: item.content }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
                onError={(error) => {
                  console.error('Video thumbnail load error in MediaGalleryScreen:', error);
                }}
              />
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: DesignTokens.colors.overlay
              }}>
                <VideoIcon size={24} color="#fff" strokeWidth={2} />
              </View>
            </View>
          ) : (
            <View style={{
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isImage ? (
                <ImageIcon size={32} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              ) : isVideo ? (
                <VideoIcon size={32} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              ) : isAudio ? (
                <Music size={32} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              ) : (
                <FileText size={32} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              )}
            </View>
          )}

          {/* Media type indicator */}
          <View style={{
            position: 'absolute',
            top: 8,
            right: 8
          }}>
            {isVideo && (
              <View style={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderRadius: 8,
                padding: 6
              }}>
                <VideoIcon size={14} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              </View>
            )}
            {isAudio && (
              <View style={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderRadius: 8,
                padding: 6
              }}>
                <Music size={14} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              </View>
            )}
            {isDocument && (
              <View style={{
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderRadius: 8,
                padding: 6
              }}>
                <FileText size={14} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40
    }}>
      <View style={{ alignItems: 'center' }}>
        {selectedTab === 'media' ? (
          <>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: `${DesignTokens.colors.success.main}1A`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20
            }}>
              <ImageIcon size={40} color={DesignTokens.colors.primary.main} strokeWidth={1.5} />
            </View>
            <Text style={{
              color: DesignTokens.colors.text.primary,
              fontSize: 20,
              fontWeight: '600',
              marginBottom: 8,
              textAlign: 'center'
            }}>
              אין מדיה בקבוצה
            </Text>
            <Text style={{
              color: DesignTokens.colors.text.secondary,
              fontSize: 15,
              textAlign: 'center',
              lineHeight: 22
            }}>
              תמונות, סרטונים וקבצי אודיו{'\n'}יופיעו כאן
            </Text>
          </>
        ) : (
          <>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: `${DesignTokens.colors.success.main}1A`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20
            }}>
              <FileText size={40} color={DesignTokens.colors.primary.main} strokeWidth={1.5} />
            </View>
            <Text style={{
              color: DesignTokens.colors.text.primary,
              fontSize: 20,
              fontWeight: '600',
              marginBottom: 8,
              textAlign: 'center'
            }}>
              אין מסמכים בקבוצה
            </Text>
            <Text style={{
              color: DesignTokens.colors.text.secondary,
              fontSize: 15,
              textAlign: 'center',
              lineHeight: 22
            }}>
              קבצי PDF, Word וקבצים אחרים{'\n'}יופיעו כאן
            </Text>
          </>
        )}
      </View>
    </View>
  );

  const mediaCount = mediaItems.filter(item => ['image', 'video', 'audio'].includes(item.type)).length;
  const documentCount = mediaItems.filter(item => item.type === 'document').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
      <StatusBar barStyle="light-content" backgroundColor={DesignTokens.colors.background.primary} />

      {/* Header */}
      <View style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: DesignTokens.colors.background.primary
      }}>
        <View style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          flex: 1
        }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              marginLeft: 16,
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowRight size={24} color={DesignTokens.colors.primary.main} strokeWidth={2} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{
              color: DesignTokens.colors.text.primary,
              fontSize: 20,
              fontWeight: '700',
              textAlign: 'right'
            }}>
              גלריית מדיה
            </Text>
            <Text style={{
              color: DesignTokens.colors.text.secondary,
              fontSize: 14,
              textAlign: 'right',
              marginTop: 2
            }}>
              {channelName}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: DesignTokens.colors.background.primary,
        marginHorizontal: 20,
        marginTop: 12,
        marginBottom: 16,
        borderRadius: 0,
        padding: 0,
        alignSelf: 'center',
        width: '100%',
        maxWidth: 400
      }}>
        <TouchableOpacity
          onPress={() => setSelectedTab('media')}
          activeOpacity={1}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 0,
            backgroundColor: 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            marginHorizontal: 0,
            borderBottomWidth: selectedTab === 'media' ? 2 : 0,
            borderBottomColor: DesignTokens.colors.primary.main
          }}
        >

          <Text style={{
            textAlign: 'center',
            fontWeight: selectedTab === 'media' ? '700' : '600',
            fontSize: 14,
            color: selectedTab === 'media' ? DesignTokens.colors.primary.main : DesignTokens.colors.text.secondary,
            position: 'relative',
            zIndex: 1
          }}>
            מדיה ({mediaCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedTab('documents')}
          activeOpacity={1}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 0,
            backgroundColor: 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            marginHorizontal: 0,
            borderBottomWidth: selectedTab === 'documents' ? 2 : 0,
            borderBottomColor: DesignTokens.colors.primary.main
          }}
        >

          <Text style={{
            textAlign: 'center',
            fontWeight: selectedTab === 'documents' ? '700' : '600',
            fontSize: 14,
            color: selectedTab === 'documents' ? DesignTokens.colors.primary.main : DesignTokens.colors.text.secondary,
            position: 'relative',
            zIndex: 1
          }}>
            מסמכים ({documentCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Media Grid */}
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {loading ? (
          <View style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: `${DesignTokens.colors.success.main}1A`,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <ImageIcon size={40} color={DesignTokens.colors.primary.main} strokeWidth={1.5} />
            </View>
            <Text style={{
              color: DesignTokens.colors.text.primary,
              fontSize: 17,
              fontWeight: '500'
            }}>טוען מדיה...</Text>
          </View>
        ) : (
          <FlatList
            data={getMediaItems()}
            renderItem={renderMediaItem}
            keyExtractor={(item) => item.id}
            numColumns={3}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={renderEmptyState}
            columnWrapperStyle={{ justifyContent: 'flex-start' }}
          />
        )}
      </View>

      {/* Media Viewer */}
      <MediaViewer
        visible={showMediaViewer}
        onClose={() => {
          setShowMediaViewer(false);
          setSelectedMedia(null);
        }}
        mediaUrl={selectedMedia?.content || ''}
        mediaType={selectedMedia?.type || 'image'}
        caption={selectedMedia?.users?.full_name || 'משתמש'}
        message={selectedMedia ? {
          id: selectedMedia.id,
          content: selectedMedia.content,
          type: selectedMedia.type,
          created_at: selectedMedia.created_at,
          sender_id: selectedMedia.sender_id,
          channel_id: chatId
        } : undefined}
        onReply={() => {
          console.log('📝 Reply requested for media');
        }}
      />
    </SafeAreaView>
  );
}

