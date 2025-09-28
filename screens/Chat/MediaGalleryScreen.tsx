import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  Dimensions, 
  SafeAreaView,
  StatusBar 
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Video as VideoIcon, ImageIcon, Music, FileText, ArrowRight } from 'lucide-react-native';
import { MediaViewer } from '../../components/chat';
import { supabase } from '../../lib/supabase';

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
  const route = useRoute();
  const navigation = useNavigation();
  const { chatId, channelName } = route.params as { chatId: string; channelName: string };
  
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'media' | 'documents'>('media');
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

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
          marginBottom: 8,
          marginHorizontal: 4
        }}
      >
        <View style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.3)',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: 'rgba(0,230,84,0.15)',
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
                backgroundColor: 'rgba(0,0,0,0.3)'
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
                <ImageIcon size={32} color="#00E654" strokeWidth={2} />
              ) : isVideo ? (
                <VideoIcon size={32} color="#00E654" strokeWidth={2} />
              ) : isAudio ? (
                <Music size={32} color="#00E654" strokeWidth={2} />
              ) : (
                <FileText size={32} color="#00E654" strokeWidth={2} />
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
                backgroundColor: 'rgba(0,0,0,0.7)',
                borderRadius: 12,
                padding: 4
              }}>
                <VideoIcon size={12} color="#fff" strokeWidth={2} />
              </View>
            )}
            {isAudio && (
              <View style={{
                backgroundColor: 'rgba(0,0,0,0.7)',
                borderRadius: 12,
                padding: 4
              }}>
                <Music size={12} color="#fff" strokeWidth={2} />
              </View>
            )}
            {isDocument && (
              <View style={{
                backgroundColor: 'rgba(0,0,0,0.7)',
                borderRadius: 12,
                padding: 4
              }}>
                <FileText size={12} color="#fff" strokeWidth={2} />
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
      padding: 32
    }}>
      <View style={{ alignItems: 'center' }}>
        {selectedTab === 'media' ? (
          <>
            <ImageIcon size={64} color="#666" strokeWidth={1.5} />
            <Text style={{
              color: '#B0B0B0',
              fontSize: 18,
              marginTop: 16,
              textAlign: 'center'
            }}>
              אין מדיה בקבוצה זו
            </Text>
            <Text style={{
              color: '#808080',
              fontSize: 14,
              marginTop: 8,
              textAlign: 'center'
            }}>
              תמונות, סרטונים וקבצי אודיו יופיעו כאן
            </Text>
          </>
        ) : (
          <>
            <FileText size={64} color="#666" strokeWidth={1.5} />
            <Text style={{
              color: '#B0B0B0',
              fontSize: 18,
              marginTop: 16,
              textAlign: 'center'
            }}>
              אין מסמכים בקבוצה זו
            </Text>
            <Text style={{
              color: '#808080',
              fontSize: 14,
              marginTop: 8,
              textAlign: 'center'
            }}>
              קבצי PDF, Word וקבצים אחרים יופיעו כאן
            </Text>
          </>
        )}
      </View>
    </View>
  );

  const mediaCount = mediaItems.filter(item => ['image', 'video', 'audio'].includes(item.type)).length;
  const documentCount = mediaItems.filter(item => item.type === 'document').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Header */}
      <View style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333333'
      }}>
        <View style={{
          flexDirection: 'row-reverse',
          alignItems: 'center'
        }}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={{ marginLeft: 16 }}
          >
            <ArrowRight size={24} color="#00E654" strokeWidth={2} />
          </TouchableOpacity>
          <View>
            <Text style={{
              color: '#FFFFFF',
              fontSize: 18,
              fontWeight: 'bold',
              textAlign: 'right'
            }}>
              {channelName}
            </Text>
            <Text style={{
              color: '#B0B0B0',
              fontSize: 14,
              textAlign: 'right'
            }}>
              גלריית מדיה
            </Text>
          </View>
        </View>
        
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: 'row-reverse',
        backgroundColor: 'rgba(0,0,0,0.3)',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: 'rgba(0,230,84,0.15)'
      }}>
        <TouchableOpacity
          onPress={() => setSelectedTab('media')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: selectedTab === 'media' ? '#00E654' : 'transparent'
          }}
        >
          <Text style={{
            textAlign: 'center',
            fontWeight: '600',
            color: selectedTab === 'media' ? '#000000' : '#B0B0B0'
          }}>
            מדיה ({mediaCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedTab('documents')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: selectedTab === 'documents' ? '#00E654' : 'transparent'
          }}
        >
          <Text style={{
            textAlign: 'center',
            fontWeight: '600',
            color: selectedTab === 'documents' ? '#000000' : '#B0B0B0'
          }}>
            מסמכים ({documentCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Media Grid */}
      <View style={{ flex: 1, padding: 16 }}>
        {loading ? (
          <View style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Text style={{
              color: '#B0B0B0',
              fontSize: 16
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

