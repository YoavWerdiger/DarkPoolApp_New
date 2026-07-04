import {
  validateMessageContent,
  validateMediaType,
  validateMediaSize,
  validateFileName,
  validateGroupId,
  validateUserId,
  validateEmoji,
  sanitizeMessageContent,
  sanitizeFileName,
  checkRateLimit,
  stopRateLimitCleanup,
} from '../../services/chat/chatValidation';

afterEach(() => {
  stopRateLimitCleanup();
});

describe('validateMessageContent', () => {
  it('rejects empty / whitespace-only content', () => {
    expect(validateMessageContent('').valid).toBe(false);
    expect(validateMessageContent('   ').valid).toBe(false);
    expect(validateMessageContent(undefined).valid).toBe(false);
  });

  it('rejects messages over 10,000 chars', () => {
    const long = 'a'.repeat(10_001);
    const result = validateMessageContent(long);
    expect(result.valid).toBe(false);
    expect(result.error?.code).toBe('MESSAGE_TOO_LONG');
  });

  it('rejects XSS-flavoured content', () => {
    expect(validateMessageContent('<script>alert(1)</script>').valid).toBe(false);
    expect(validateMessageContent('javascript:alert(1)').valid).toBe(false);
    expect(validateMessageContent('<img onerror=alert(1)>').valid).toBe(false);
  });

  it('accepts normal Hebrew + English content', () => {
    expect(validateMessageContent('שלום עולם').valid).toBe(true);
    expect(validateMessageContent('Hello, what about RSI(14)?').valid).toBe(true);
  });
});

describe('sanitizeMessageContent', () => {
  it('escapes HTML angle brackets', () => {
    expect(sanitizeMessageContent('<b>hi</b>')).toBe('&lt;b&gt;hi&lt;/b&gt;');
  });

  it('strips null + control characters', () => {
    expect(sanitizeMessageContent('a\u0000b\u0001c')).toBe('abc');
  });

  it('preserves already-escaped HTML entities', () => {
    // The sanitizer should not double-escape known entities.
    expect(sanitizeMessageContent('A &amp; B')).toBe('A &amp; B');
  });
});

describe('validateMediaType', () => {
  it('accepts allowed image mime types for image messages', () => {
    expect(validateMediaType('image/png', 'image').valid).toBe(true);
    expect(validateMediaType('image/heic', 'image').valid).toBe(true);
  });

  it('rejects mime/message type mismatches', () => {
    expect(validateMediaType('video/mp4', 'image').valid).toBe(false);
    expect(validateMediaType('image/png', 'audio').valid).toBe(false);
  });

  it('rejects unknown message types', () => {
    const r = validateMediaType('image/png', 'bogus');
    expect(r.valid).toBe(false);
    expect(r.error?.code).toBe('INVALID_MESSAGE_TYPE');
  });
});

describe('validateMediaSize', () => {
  it('rejects files over 100MB', () => {
    expect(validateMediaSize(101 * 1024 * 1024).valid).toBe(false);
  });

  it('accepts files just under the limit', () => {
    expect(validateMediaSize(99 * 1024 * 1024).valid).toBe(true);
  });
});

describe('validateFileName + sanitizeFileName', () => {
  it('rejects empty and overlong names', () => {
    expect(validateFileName('').valid).toBe(false);
    expect(validateFileName('x'.repeat(256)).valid).toBe(false);
  });

  it('rejects dangerous characters', () => {
    expect(validateFileName('a<b>c').valid).toBe(false);
    expect(validateFileName('a"b').valid).toBe(false);
    expect(validateFileName('a|b').valid).toBe(false);
  });

  it('neutralises path traversal in sanitisation', () => {
    expect(sanitizeFileName('../../etc/passwd')).not.toContain('..');
  });
});

describe('validateGroupId / validateUserId', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';

  it('accepts a valid UUID v4-ish format', () => {
    expect(validateGroupId(validUuid).valid).toBe(true);
    expect(validateUserId(validUuid).valid).toBe(true);
  });

  it('rejects non-UUID input', () => {
    expect(validateGroupId('hi').valid).toBe(false);
    expect(validateGroupId('').valid).toBe(false);
    expect(validateGroupId(null as unknown as string).valid).toBe(false);
  });
});

describe('validateEmoji', () => {
  it('accepts a single emoji', () => {
    expect(validateEmoji('🔥').valid).toBe(true);
  });

  it('rejects plain text', () => {
    expect(validateEmoji('hi').valid).toBe(false);
    expect(validateEmoji('').valid).toBe(false);
  });
});

describe('checkRateLimit', () => {
  it('allows the first message and blocks past the per-minute limit', () => {
    const uid = '123e4567-e89b-12d3-a456-426614174999';

    // Text limit is 30/min.
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit(uid, false).allowed).toBe(true);
    }
    const blocked = checkRateLimit(uid, false);
    expect(blocked.allowed).toBe(false);
    expect(blocked.error?.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('tracks media and text limits independently', () => {
    const uid = '223e4567-e89b-12d3-a456-426614174999';
    for (let i = 0; i < 30; i++) checkRateLimit(uid, false);

    // Even though text bucket is full, media bucket should still allow.
    expect(checkRateLimit(uid, true).allowed).toBe(true);
  });
});
