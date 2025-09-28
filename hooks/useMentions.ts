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
    console.log('🎯 insertMention called with user:', user);
    
    // Find the @ symbol position in the current text
    const currentText = text || '';
    const atSymbolIndex = currentText.lastIndexOf('@');
    if (atSymbolIndex === -1) {
      console.log('❌ No @ symbol found in text');
      return;
    }

    // Create new text with mention inserted
    const beforeMention = currentText.substring(0, atSymbolIndex);
    const afterMention = currentText.substring(atSymbolIndex + 1);
    const spaceIndex = afterMention.indexOf(' ');
    
    let newText: string;
    if (spaceIndex === -1) {
      // No space after @, replace everything after @
      newText = beforeMention + user.display + ' ';
    } else {
      // Space found, replace text between @ and space
      newText = beforeMention + user.display + ' ' + afterMention.substring(spaceIndex + 1);
    }

    console.log('🎯 New text created:', newText);

    // Add mention token
    const newToken: MentionToken = {
      id: user.id,
      display: user.display,
      start: atSymbolIndex,
      end: atSymbolIndex + user.display.length,
    };

    console.log('🎯 New mention token:', newToken);

    setMentionTokens(prev => {
      console.log('🎯 Previous mention tokens:', prev);
      
      // Remove any overlapping tokens
      const filtered = prev.filter(token => 
        token.end <= atSymbolIndex || token.start >= atSymbolIndex + user.display.length
      );
      
      // Adjust positions of tokens that come after
      const adjusted = filtered.map(token => {
        if (token.start > atSymbolIndex) {
          const shift = user.display.length + 1;
          return {
            ...token,
            start: token.start + shift,
            end: token.end + shift,
          };
        }
        return token;
      });

      const result = [...adjusted, newToken].sort((a, b) => a.start - b.start);
      console.log('🎯 Updated mention tokens:', result);
      return result;
    });

    setShowMentionPicker(false);
    setMentionSearchQuery('');
    
    // Return the new text so MessageInputBar can update its state
    return newText;
  }, [text]);

  const handleInputChange = useCallback((text: string) => {
    console.log('🎯 handleInputChange called with text:', text);
    
    // Check for @ symbol to show mention picker
    const lastAtSymbol = text.lastIndexOf('@');
    if (lastAtSymbol !== -1) {
      const afterAt = text.substring(lastAtSymbol + 1);
      const spaceIndex = afterAt.indexOf(' ');
      
      console.log('🎯 Found @ at position:', lastAtSymbol);
      console.log('🎯 Text after @:', afterAt);
      console.log('🎯 Space index:', spaceIndex);
      
      // Only show mention picker if there's no space after @ and we're still typing
      if (spaceIndex === -1 && afterAt.length > 0) {
        console.log('🎯 Showing mention picker');
        setShowMentionPicker(true);
        setMentionSearchQuery(afterAt);
        return;
      } else {
        console.log('🎯 Hiding mention picker - space found or no text after @');
      }
    }
    
    // Hide mention picker if no @ or if there's a space after @
    setShowMentionPicker(false);
    
    // Update mention tokens positions if text changed
    setMentionTokens(prev => {
      return prev.map(token => {
        const tokenText = text.substring(token.start, token.end);
        if (tokenText === token.display) {
          return token; // Token is still valid
        }
        
        // Token was modified, remove it
        return null;
      }).filter(Boolean) as MentionToken[];
    });
  }, []);

  const removeMention = useCallback((tokenId: string) => {
    setMentionTokens(prev => {
      const token = prev.find(t => t.id === tokenId);
      if (!token) return prev;

      // Remove the token from text
      if (inputRef.current) {
        const currentText = inputRef.current.value || '';
        const beforeToken = currentText.substring(0, token.start);
        const afterToken = currentText.substring(token.end);
        const newText = beforeToken + afterToken;

        inputRef.current.value = newText;
        
        // Trigger input change
        if (inputRef.current.onChangeText) {
          inputRef.current.onChangeText(newText);
        }
      }

      // Remove token and adjust positions
      return prev
        .filter(t => t.id !== tokenId)
        .map(t => {
          if (t.start > token.start) {
            const shift = token.end - token.start;
            return {
              ...t,
              start: t.start - shift,
              end: t.end - shift,
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
  };
};
