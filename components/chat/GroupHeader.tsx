import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChatService } from '../../services/chatService';
import { supabase } from '../../lib/supabase';
import { useDesignTokens } from '../ui/DesignTokens';
import { ChevronRight } from 'lucide-react-native';

export default function GroupHeader({ chatId }: { chatId: string | null }) {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation<any>();
  const [group, setGroup] = useState<any>(null);
  const [membersCount, setMembersCount] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!chatId) return;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('channels')
          .select('id, name, image_url, icon_name')
          .eq('id', chatId)
          .single();
        
        if (error) {
          console.error('❌ GroupHeader: Error loading channel:', error);
          return;
        }
        
        setGroup(data);
        console.log('✅ GroupHeader: Channel loaded:', data?.name, 'image_url:', data?.image_url);
        
        // טיפול בתמונה - אם זה path ב-storage, נקבל signed URL
        if (data?.image_url) {
          let finalImageUrl = data.image_url;
          
          // אם זה לא URL מלא, ננסה לקבל signed URL
          if (!data.image_url.startsWith('http')) {
            console.log('🔄 GroupHeader: image_url is not a full URL, trying to get signed URL:', data.image_url);
            
            // ננסה מספר buckets אפשריים
            const bucketsToTry = ['chat-files', 'media', 'app-media', 'avatars'];
            let signedUrlFound = false;
            
            for (const bucketName of bucketsToTry) {
              try {
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                  .from(bucketName)
                  .createSignedUrl(data.image_url, 3600);
                
                if (!signedUrlError && signedUrlData) {
                  finalImageUrl = signedUrlData.signedUrl;
                  console.log('✅ GroupHeader: Got signed URL from bucket:', bucketName);
                  signedUrlFound = true;
                  break;
                }
              } catch (error) {
                console.log(`⚠️ GroupHeader: Could not get signed URL from bucket ${bucketName}:`, error);
              }
            }
            
            if (!signedUrlFound) {
              console.log('⚠️ GroupHeader: Could not get signed URL from any bucket, using original:', data.image_url);
              // אם לא מצאנו signed URL, ננסה להשתמש ב-URL הציבורי
              finalImageUrl = `https://wpmrtczbfcijoocguime.supabase.co/storage/v1/object/public/chat-files/${data.image_url}`;
            }
          } else {
            console.log('✅ GroupHeader: image_url is already a full URL');
          }
          
          setImageUrl(finalImageUrl);
        } else {
          console.log('⚠️ GroupHeader: No image_url found for channel');
          setImageUrl(null);
        }
        
        const { count } = await ChatService.getChannelMembersCount(chatId);
        if (typeof count === 'number') setMembersCount(count);
      } catch (error) {
        console.error('❌ GroupHeader: Error in load:', error);
      }
    };
    load();
  }, [chatId]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: DesignTokens.colors.background.primary,
      height: 60,
      borderBottomWidth: 1,
      borderBottomColor: DesignTokens.colors.border.primary,
    },
    backButton: {
      padding: 8,
      marginRight: -4,
    },
    image: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginLeft: 10,
    },
    placeholderImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: DesignTokens.colors.primary.main,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
    },
    placeholderText: {
      fontSize: 16,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    textContainer: {
      flex: 1,
      justifyContent: 'center',
      marginRight: 4,
    },
    groupName: {
      fontSize: 16,
      color: DesignTokens.colors.text.primary,
      fontWeight: '600',
      textAlign: 'right',
    },
    membersCount: {
      fontSize: 11,
      color: DesignTokens.colors.text.secondary,
      marginTop: 1,
      textAlign: 'right',
    },
  }), [DesignTokens]);

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('GroupInfo', { chatId })}
      activeOpacity={0.7}
      style={styles.container}
    >
      {/* Back Button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <ChevronRight size={24} color={DesignTokens.colors.primary.main} strokeWidth={2.5} />
      </TouchableOpacity>

      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
          onError={(error) => {
            console.error('❌ GroupHeader: Image load error:', error);
            setImageUrl(null);
          }}
        />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>
            {group?.name ? group.name[0] : '?'}
          </Text>
        </View>
      )}

      <View style={styles.textContainer}>
        <Text style={styles.groupName} numberOfLines={1}>
          {group?.name || 'קבוצה'}
        </Text>
        <Text style={styles.membersCount} numberOfLines={1}>
          {membersCount ?? 0} משתתפים
        </Text>
      </View>
    </TouchableOpacity>
  );
}


