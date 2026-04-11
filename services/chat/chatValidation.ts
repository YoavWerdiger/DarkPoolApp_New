// ============================================
// Chat Validation Utilities
// ============================================
// Validation and sanitization for chat inputs
// ============================================

import { ChatError } from '../../types/chat.types';

// ============================================
// Constants
// ============================================

const MAX_MESSAGE_LENGTH = 10000; // 10K characters
const MAX_MEDIA_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILE_NAME_LENGTH = 255;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv', 'video/webm'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/m4a'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// Rate limiting (messages per minute)
const RATE_LIMIT_MESSAGES_PER_MINUTE = 30;
const RATE_LIMIT_MEDIA_PER_MINUTE = 10;

// ============================================
// Rate Limiting
// ============================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function cleanExpiredRateLimits() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

let rateLimitCleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureRateLimitCleanup() {
  if (!rateLimitCleanupInterval) {
    rateLimitCleanupInterval = setInterval(cleanExpiredRateLimits, 2 * 60 * 1000);
  }
}

export function stopRateLimitCleanup() {
  if (rateLimitCleanupInterval) {
    clearInterval(rateLimitCleanupInterval);
    rateLimitCleanupInterval = null;
  }
  rateLimitStore.clear();
}

export function checkRateLimit(
  userId: string,
  isMedia: boolean = false
): { allowed: boolean; error?: ChatError } {
  ensureRateLimitCleanup();
  const key = `${userId}:${isMedia ? 'media' : 'text'}`;
  const limit = isMedia ? RATE_LIMIT_MEDIA_PER_MINUTE : RATE_LIMIT_MESSAGES_PER_MINUTE;
  const now = Date.now();
  const oneMinute = 60 * 1000;

  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + oneMinute });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `חרגת ממגבלת השליחה. נסה שוב בעוד ${Math.ceil((entry.resetTime - now) / 1000)} שניות`,
      },
    };
  }

  entry.count++;
  return { allowed: true };
}

// ============================================
// Input Validation
// ============================================

export function validateMessageContent(content?: string): { valid: boolean; error?: ChatError } {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: { code: 'EMPTY_MESSAGE', message: 'הודעה לא יכולה להיות ריקה' } };
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: {
        code: 'MESSAGE_TOO_LONG',
        message: `הודעה לא יכולה להיות ארוכה מ-${MAX_MESSAGE_LENGTH} תווים`,
      },
    };
  }

  // Check for potential XSS
  const dangerousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onerror, etc.
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return {
        valid: false,
        error: { code: 'INVALID_CONTENT', message: 'התוכן מכיל תווים לא מורשים' },
      };
    }
  }

  return { valid: true };
}

export function validateMediaType(mediaType: string, messageType: string): { valid: boolean; error?: ChatError } {
  let allowedTypes: string[] = [];

  switch (messageType) {
    case 'image':
      allowedTypes = ALLOWED_IMAGE_TYPES;
      break;
    case 'video':
      allowedTypes = ALLOWED_VIDEO_TYPES;
      break;
    case 'audio':
      allowedTypes = ALLOWED_AUDIO_TYPES;
      break;
    case 'document':
      allowedTypes = ALLOWED_DOCUMENT_TYPES;
      break;
    default:
      return { valid: false, error: { code: 'INVALID_MESSAGE_TYPE', message: 'סוג הודעה לא תקין' } };
  }

  if (!allowedTypes.includes(mediaType)) {
    return {
      valid: false,
      error: {
        code: 'INVALID_MEDIA_TYPE',
        message: `סוג קובץ לא נתמך. סוגים מותרים: ${allowedTypes.join(', ')}`,
      },
    };
  }

  return { valid: true };
}

export function validateMediaSize(size: number): { valid: boolean; error?: ChatError } {
  if (size > MAX_MEDIA_SIZE) {
    return {
      valid: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: `קובץ גדול מדי. גודל מקסימלי: ${MAX_MEDIA_SIZE / (1024 * 1024)}MB`,
      },
    };
  }

  return { valid: true };
}

export function validateFileName(fileName: string): { valid: boolean; error?: ChatError } {
  if (!fileName || fileName.trim().length === 0) {
    return { valid: false, error: { code: 'INVALID_FILE_NAME', message: 'שם קובץ לא תקין' } };
  }

  if (fileName.length > MAX_FILE_NAME_LENGTH) {
    return {
      valid: false,
      error: {
        code: 'FILE_NAME_TOO_LONG',
        message: `שם קובץ ארוך מדי. מקסימום ${MAX_FILE_NAME_LENGTH} תווים`,
      },
    };
  }

  // Check for dangerous characters
  const dangerousChars = /[<>:"|?*\x00-\x1f]/;
  if (dangerousChars.test(fileName)) {
    return {
      valid: false,
      error: { code: 'INVALID_FILE_NAME', message: 'שם קובץ מכיל תווים לא מורשים' },
    };
  }

  return { valid: true };
}

export function sanitizeMessageContent(content: string): string {
  return content
    .replace(/\x00/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&(?!lt;|gt;|amp;|quot;|#39;)/g, '&amp;')
    .trim();
}

export function sanitizeFileName(fileName: string): string {
  // Remove dangerous characters and normalize
  return fileName
    .replace(/[<>:"|?*\x00-\x1f]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\.+/, '')
    .trim()
    .substring(0, MAX_FILE_NAME_LENGTH);
}

// ============================================
// Group ID Validation
// ============================================

export function validateGroupId(groupId: string): { valid: boolean; error?: ChatError } {
  if (!groupId || typeof groupId !== 'string') {
    return { valid: false, error: { code: 'INVALID_GROUP_ID', message: 'מזהה קבוצה לא תקין' } };
  }

  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(groupId)) {
    return { valid: false, error: { code: 'INVALID_GROUP_ID', message: 'מזהה קבוצה לא תקין' } };
  }

  return { valid: true };
}

// ============================================
// User ID Validation
// ============================================

export function validateUserId(userId: string): { valid: boolean; error?: ChatError } {
  if (!userId || typeof userId !== 'string') {
    return { valid: false, error: { code: 'INVALID_USER_ID', message: 'מזהה משתמש לא תקין' } };
  }

  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return { valid: false, error: { code: 'INVALID_USER_ID', message: 'מזהה משתמש לא תקין' } };
  }

  return { valid: true };
}

const EMOJI_REGEX = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u;
const MAX_EMOJI_LENGTH = 10;

export function validateEmoji(emoji: string): { valid: boolean; error?: ChatError } {
  if (!emoji || typeof emoji !== 'string') {
    return { valid: false, error: { code: 'INVALID_EMOJI', message: 'אמוג\'י לא תקין' } };
  }

  if (emoji.length > MAX_EMOJI_LENGTH) {
    return { valid: false, error: { code: 'INVALID_EMOJI', message: 'אמוג\'י ארוך מדי' } };
  }

  if (!EMOJI_REGEX.test(emoji)) {
    return { valid: false, error: { code: 'INVALID_EMOJI', message: 'רק אמוג\'י מותר כריאקציה' } };
  }

  return { valid: true };
}

