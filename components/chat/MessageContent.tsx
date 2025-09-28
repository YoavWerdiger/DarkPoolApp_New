import React from 'react';
import { Text } from 'react-native';
import { DesignTokens } from '../ui/DesignTokens';
import { extractTextSegments } from '../../utils/textRanges';

interface MessageContentProps {
  content: string;
  mentions?: any[];
  isMe: boolean;
  textDirection: 'rtl' | 'ltr';
}

export default function MessageContent({ 
  content, 
  mentions, 
  isMe, 
  textDirection 
}: MessageContentProps) {
  
  // Render text with mentions
  const renderTextWithMentions = (text: string, mentions?: any[]) => {
    if (!mentions || mentions.length === 0) {
      return (
        <Text 
          className="text-base"
          style={{ 
            textAlign: textDirection === 'rtl' ? 'left' : 'right',
            direction: textDirection, 
            width: '100%',
            color: isMe ? '#000000' : '#FFFFFF',
            writingDirection: textDirection
          }}
        >
          {text}
        </Text>
      );
    }

    const segments = extractTextSegments(text, mentions.map(mention => ({
      start: mention.start,
      end: mention.end,
      type: 'mention' as const,
      data: mention,
    })));

    return (
      <Text 
        className="text-base"
        style={{ 
          textAlign: textDirection === 'rtl' ? 'left' : 'right',
          direction: textDirection, 
          width: '100%',
          writingDirection: textDirection
        }}
      >
        {segments.map((segment, index) => {
          if (segment.range && segment.range.type === 'mention') {
            const mention = segment.range.data;
            
            return (
              <Text
                key={index}
                style={{ 
                  fontWeight: 'bold' as const,
                  color: DesignTokens.colors.primary,
                  fontSize: DesignTokens.typography.fontSize.base
                }}
              >
                {segment.text}
              </Text>
            );
          }
          
          return (
            <Text
              key={index}
              style={{ 
                color: isMe ? '#000000' : '#FFFFFF',
                fontSize: DesignTokens.typography.fontSize.base
              }}
            >
              {segment.text}
            </Text>
          );
        })}
      </Text>
    );
  };

  return renderTextWithMentions(content, mentions);
}
