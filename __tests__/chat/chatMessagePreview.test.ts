import { getChatMessagePreview } from '../../utils/chatMessagePreview';

const attachment = {
  v: 1,
  ref: { type: 'journal_trade', id: 't1' },
  preview: { title: 'AAPL · LONG' },
  sharedAt: '2026-10-04T12:00:00.000Z',
};

describe('getChatMessagePreview — entity share', () => {
  it('labels an entity attachment even without message_type (server last_message_preview)', () => {
    const content = JSON.stringify({ attachment });
    expect(getChatMessagePreview(undefined, content)).toBe('📎 AAPL · LONG');
  });

  it('prefers the caption when the share has one', () => {
    const content = JSON.stringify({ attachment, caption: 'תראו את זה' });
    expect(getChatMessagePreview(undefined, content)).toBe('תראו את זה');
  });

  it('never returns raw JSON for an entity payload', () => {
    const content = JSON.stringify({ attachment });
    expect(getChatMessagePreview('text', content).startsWith('{')).toBe(false);
  });

  it('keeps plain text as is', () => {
    expect(getChatMessagePreview('text', 'שלום')).toBe('שלום');
  });
});

describe('getChatMessagePreview — truncated JSON (old last_message_preview)', () => {
  it('shows attachment title, not raw JSON', () => {
    const cut = '{"attachment":{"v":1,"ref":{"type":"news_article","id":"1"},"preview":{"title":"מניות LULU בשפל';
    expect(getChatMessagePreview(undefined, cut)).toBe('📎 מניות LULU בשפל');
  });
  it('shows a generic share label when title is cut off', () => {
    expect(getChatMessagePreview(undefined, '{"attachment":{"v":1,"ref":{"type":"person_profile","id":"P0')).toBe('📎 שיתוף');
  });
  it('shows voice label for truncated waveform', () => {
    expect(getChatMessagePreview(undefined, '{"waveform":[0.42,1,1,0.83')).toBe('הודעה קולית');
  });
});
