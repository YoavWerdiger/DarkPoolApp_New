import React from 'react';
import { View, Text, Image } from 'react-native';
import { MessageSnapshot } from '../../types/MessageSnapshot';
import { useDesignTokens } from '../ui/DesignTokens';

interface MessagePreviewProps {
  message: MessageSnapshot;
}

export default function MessagePreview({ message }: MessagePreviewProps) {
  const DesignTokens = useDesignTokens();

  return (
    <View style={{
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxWidth: 280,
      minWidth: 60,
      backgroundColor: message.isMe ? DesignTokens.colors.primary.main : DesignTokens.colors.bubbleOther,
      shadowColor: message.isMe ? DesignTokens.colors.primary.main : '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: message.isMe ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 3,
      alignSelf: message.isMe ? 'flex-end' : 'flex-start',
      borderWidth: message.isMe ? 0 : 0.5,
      borderColor: message.isMe ? 'transparent' : DesignTokens.colors.border.primary
    }}>
      {message.senderAvatar && !message.isMe && (
        <Image
          source={{ uri: message.senderAvatar }}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            marginBottom: 6
          }}
        />
      )}
      <View style={{ flex: 1 }}>
        {message.senderName && !message.isMe && (
          <Text style={{
            color: DesignTokens.colors.success.main,
            fontWeight: '700',
            marginBottom: 4,
            fontSize: 12
          }}>
            {message.senderName}
          </Text>
        )}
        {message.mediaUrl ? (
          <Image
            source={{ uri: message.mediaUrl }}
            style={{
              width: 200,
              height: 120,
              borderRadius: 10,
              marginBottom: 4
            }}
          />
        ) : (
          <Text style={{
            fontSize: 16,
            lineHeight: 20,
            color: message.isMe ? '#FFFFFF' : DesignTokens.colors.text.primary
          }}>
            {message.content}
          </Text>
        )}
        <Text style={{
          fontSize: 10,
          marginTop: 4,
          alignSelf: 'flex-end',
          color: message.isMe ? 'rgba(255,255,255,0.8)' : DesignTokens.colors.text.tertiary
        }}>
          {message.timestamp || ''}
        </Text>
      </View>
    </View>
  );
}
