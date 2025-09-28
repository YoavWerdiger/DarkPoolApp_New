export interface TextRange {
  start: number;
  end: number;
  type: 'mention' | 'highlight' | 'link';
  data?: any;
}

export interface MentionRange {
  user_id: string;
  start: number;
  end: number;
  display: string;
}

/**
 * Calculate UTF-16 character indices for text ranges
 */
export const calculateTextRanges = (
  text: string,
  mentions: MentionRange[]
): TextRange[] => {
  const ranges: TextRange[] = [];
  
  mentions.forEach(mention => {
    if (mention.start >= 0 && mention.end <= text.length) {
      ranges.push({
        start: mention.start,
        end: mention.end,
        type: 'mention',
        data: mention,
      });
    }
  });
  
  return ranges.sort((a, b) => a.start - b.start);
};

/**
 * Merge overlapping or adjacent text ranges
 */
export const mergeTextRanges = (ranges: TextRange[]): TextRange[] => {
  if (ranges.length <= 1) return ranges;
  
  const sorted = ranges.sort((a, b) => a.start - b.start);
  const merged: TextRange[] = [];
  let current = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    
    if (current.end >= next.start) {
      // Overlapping or adjacent ranges
      current = {
        start: current.start,
        end: Math.max(current.end, next.end),
        type: current.type,
        data: { ...current.data, ...next.data },
      };
    } else {
      merged.push(current);
      current = next;
    }
  }
  
  merged.push(current);
  return merged;
};

/**
 * Sanitize text ranges to ensure they're within bounds
 */
export const sanitizeTextRanges = (
  ranges: TextRange[],
  textLength: number
): TextRange[] => {
  return ranges
    .filter(range => range.start >= 0 && range.end <= textLength)
    .map(range => ({
      ...range,
      start: Math.max(0, range.start),
      end: Math.min(textLength, range.end),
    }));
};

/**
 * Extract text segments with their associated ranges
 */
export const extractTextSegments = (
  text: string,
  ranges: TextRange[]
): Array<{ text: string; range?: TextRange }> => {
  if (ranges.length === 0) {
    return [{ text }];
  }
  
  const segments: Array<{ text: string; range?: TextRange }> = [];
  let lastIndex = 0;
  
  ranges.forEach(range => {
    // Add text before the range
    if (range.start > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, range.start),
      });
    }
    
    // Add the ranged text
    segments.push({
      text: text.substring(range.start, range.end),
      range,
    });
    
    lastIndex = range.end;
  });
  
  // Add remaining text after the last range
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
    });
  }
  
  return segments;
};

/**
 * Check if a position is within any range
 */
export const isPositionInRange = (
  position: number,
  ranges: TextRange[]
): boolean => {
  return ranges.some(range => position >= range.start && position < range.end);
};

/**
 * Find the range at a specific position
 */
export const findRangeAtPosition = (
  position: number,
  ranges: TextRange[]
): TextRange | null => {
  return ranges.find(range => position >= range.start && position < range.end) || null;
};

/**
 * Adjust ranges when text is inserted/deleted
 */
export const adjustRangesForTextChange = (
  ranges: TextRange[],
  changeStart: number,
  changeEnd: number,
  newTextLength: number
): TextRange[] => {
  const changeLength = newTextLength - (changeEnd - changeStart);
  
  return ranges.map(range => {
    if (range.end <= changeStart) {
      // Range is before the change, no adjustment needed
      return range;
    }
    
    if (range.start >= changeEnd) {
      // Range is after the change, shift by the change length
      return {
        ...range,
        start: range.start + changeLength,
        end: range.end + changeLength,
      };
    }
    
    if (range.start < changeStart && range.end > changeEnd) {
      // Range spans the change, adjust end only
      return {
        ...range,
        end: range.end + changeLength,
      };
    }
    
    // Range overlaps with change, invalidate it
    return null;
  }).filter(Boolean) as TextRange[];
};
