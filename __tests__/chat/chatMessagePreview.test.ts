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
