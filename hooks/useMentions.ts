import { useState, useCallback, useRef } from 'react';

export interface MentionToken {
  id: string;
  display: string;
  start: number;
  end: number;
}

export interface MentionRange {
  user_id: string;
  start: number;
  end: number;
  display: string;
}

export const useMentions = (text: string) => {
  const [mentionTokens, setMentionTokens] = useState<MentionToken[]>([]);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const inputRef = useRef<any>(null);

  const insertMention = useCallback((user: { id: string; display: string }) => {
    // Find the @ symbol position in the current text
    const currentText = text || '';
    const atSymbolIndex = currentText.lastIndexOf('@');
    if (atSymbolIndex === -1) {
      return undefined;
    }

    // וידוא שה-display מתחיל עם @ (אם לא - נוסיף)
    const displayText = user.display.startsWith('@') ? user.display : `@${user.display}`;

    // Create new text with mention inserted
    const beforeMention = currentText.substring(0, atSymbolIndex);
    const afterMention = currentText.substring(atSymbolIndex + 1);
    const spaceIndex = afterMention.indexOf(' ');
    
    let newText: string;
    if (spaceIndex === -1) {
      // No space after @, replace everything after @
      newText = beforeMention + displayText + ' ';
    } else {
      // Space found, replace text between @ and space
      newText = beforeMention + displayText + ' ' + afterMention.substring(spaceIndex + 1);
    }

    // Add mention token
    const newToken: MentionToken = {
      id: user.id,
      display: displayText,
      start: atSymbolIndex,
      end: atSymbolIndex + displayText.length,
    };

    setMentionTokens(prev => {
      // Remove any overlapping tokens
      const filtered = prev.filter(token => 
        token.end <= atSymbolIndex || token.start >= atSymbolIndex + displayText.length
      );
      
      // Adjust positions of tokens that come after
      const adjusted = filtered.map(token => {
        if (token.start > atSymbolIndex) {
          const shift = displayText.length + 1;
          return {
            ...token,
            start: token.start + shift,
            end: token.end + shift,
          };
        }
        return token;
      });

      const result = [...adjusted, newToken].sort((a, b) => a.start - b.start);
      return result;
    });

    setShowMentionPicker(false);
    setMentionSearchQuery('');
    
    // Return the new text so MessageInputBar can update its state
    return newText;
  }, [text]);

  const handleInputChange = useCallback((inputText: string) => {
    // Handle empty text
    if (!inputText || inputText.length === 0) {
      setShowMentionPicker(false);
      setMentionSearchQuery('');
      setMentionTokens([]);
      return;
    }
    
    // Check for @ symbol to show mention picker
    const lastAtSymbol = inputText.lastIndexOf('@');
    if (lastAtSymbol !== -1) {
      const afterAt = inputText.substring(lastAtSymbol + 1);
      const spaceIndex = afterAt.indexOf(' ');
      const newlineIndex = afterAt.indexOf('\n');
      
      // בדיקה אם יש רווח או שורה חדשה
      const hasDelimiter = spaceIndex !== -1 || newlineIndex !== -1;
      
      // Only show mention picker if there's no delimiter after @ and we're still typing
      // גם כשיש רק @ בלי תווים אחריו - נציג את הפיקר
      if (!hasDelimiter) {
        setShowMentionPicker(true);
        setMentionSearchQuery(afterAt);
        return;
      }
    }
    
    // Hide mention picker if no @ or if there's a space after @
    setShowMentionPicker(false);
    setMentionSearchQuery('');
    
    // Update mention tokens - validate that each token still exists in text
    setMentionTokens(prev => {
      return prev.filter(token => {
        // בדיקת גבולות - וידוא שה-token עדיין בגבולות הטקסט
        if (token.start < 0 || token.end > inputText.length) {
          return false;
        }
        
        const tokenText = inputText.substring(token.start, token.end);
        return tokenText === token.display;
      });
    });
  }, []);

  const removeMention = useCallback((tokenId: string) => {
    setMentionTokens(prev => {
      const token = prev.find(t => t.id === tokenId);
      if (!token) return prev;

      // Remove token and adjust positions of later tokens
      const tokenLength = token.end - token.start;
      
      return prev
        .filter(t => t.id !== tokenId)
        .map(t => {
          if (t.start > token.start) {
            return {
              ...t,
              start: t.start - tokenLength,
              end: t.end - tokenLength,
            };
          }
          return t;
        });
    });
  }, []);

  const getMentionRanges = useCallback((text: string): MentionRange[] => {
    return mentionTokens.map(token => ({
      user_id: token.id,
      start: token.start,
      end: token.end,
      display: token.display,
    }));
  }, [mentionTokens]);

  const closeMentionPicker = useCallback(() => {
    setShowMentionPicker(false);
    setMentionSearchQuery('');
  }, []);

  // איפוס כל ה-mentions (קריאה כששולחים הודעה)
  const clearAllMentions = useCallback(() => {
    setMentionTokens([]);
    setShowMentionPicker(false);
    setMentionSearchQuery('');
  }, []);

  return {
    mentionTokens,
    showMentionPicker,
    mentionSearchQuery,
    inputRef,
    insertMention,
    handleInputChange,
    removeMention,
    getMentionRanges,
    closeMentionPicker,
    clearAllMentions,
  };
};
