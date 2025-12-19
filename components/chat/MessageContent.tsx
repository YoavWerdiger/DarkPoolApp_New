import React from 'react';
import { Text, I18nManager } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';
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
  const DesignTokens = useDesignTokens();

  // Render text with mentions
  const renderTextWithMentions = (text: string, mentions?: any[]) => {
    if (!mentions || mentions.length === 0) {
      return (
        <Text
          className="text-base"
          style={{
            textAlign: isMe ? (textDirection === 'rtl' ? 'right' : 'left') : 'right',
            width: '100%',
            color: isMe ? '#000000' : '#FFFFFF',
            writingDirection: textDirection,
            flexWrap: 'wrap',
            flexShrink: 1
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
          textAlign: isMe ? (textDirection === 'rtl' ? 'right' : 'left') : 'right',
          width: '100%',
          writingDirection: textDirection,
          flexWrap: 'wrap',
          flexShrink: 1
        }}
      >
        {segments.map((segment, index) => {
          // יצירת key ייחודי על בסיס התוכן, המיקום, והאורך של הטקסט המלא
          // זה מבטיח שגם אם יש שני segments עם אותו טקסט, ה-key יהיה ייחודי
          const uniqueKey = `segment-${index}-${segment.text.substring(0, 10)}-${segment.range?.type || 'text'}-${text.length}-${segments.length}`;
          
          if (segment.range && segment.range.type === 'mention') {
            const mention = segment.range.data;

            return (
              <Text
                key={uniqueKey}
                style={{
                  fontWeight: 'bold' as const,
                  color: DesignTokens.colors.primary.main,
                  fontSize: DesignTokens.typography.fontSize.base
                }}
              >
                {segment.text}
              </Text>
            );
          }

          return (
            <Text
              key={uniqueKey}
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
