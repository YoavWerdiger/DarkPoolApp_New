import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { MessageSnapshot } from '../../types/MessageSnapshot';

interface MessagePreviewProps {
  message: MessageSnapshot;
}

export default function MessagePreview({ message }: MessagePreviewProps) {
  return (
    <View style={[
      styles.bubble,
      message.isMe ? styles.myMessage : styles.otherMessage
    ]}>
      {message.senderAvatar && !message.isMe && (
        <Image source={{ uri: message.senderAvatar }} style={styles.avatar} />
      )}
      <View style={styles.content}>
        {message.senderName && !message.isMe && (
          <Text style={styles.sender}>{message.senderName}</Text>
        )}
        {message.mediaUrl ? (
          <Image source={{ uri: message.mediaUrl }} style={styles.media} />
        ) : (
          <Text style={[
            styles.text,
            { color: message.isMe ? '#fff' : '#000' }
          ]}>
            {message.content}
          </Text>
        )}
        <Text style={[
          styles.time,
          { color: message.isMe ? 'rgba(255,255,255,0.7)' : '#8E8E93' }
        ]}>
          {message.timestamp || ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 280,
    minWidth: 60,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignSelf: 'center',
  },
  myMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: '#E5E5EA',
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginBottom: 6,
  },
  sender: {
    color: '#00E654',
    fontWeight: '700',
    marginBottom: 4,
    fontSize: 12,
  },
  text: {
    fontSize: 16,
    lineHeight: 20,
  },
  media: {
    width: 200,
    height: 120,
    borderRadius: 10,
    marginBottom: 4,
  },
  time: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
});
