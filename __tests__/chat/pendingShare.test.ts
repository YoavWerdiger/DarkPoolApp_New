import {
  assignIncomingShareToGroup,
  clearIncomingShare,
  consumeShareForGroup,
  peekIncomingShare,
  pendingShareFromIntent,
  setIncomingShare,
} from '../../lib/pendingShare';

const file = (path: string, mimeType: string) => ({
  path,
  mimeType,
  fileName: 'x',
  size: null,
  width: 100,
  height: 80,
  duration: null,
});

describe('pendingShareFromIntent', () => {
  it('maps images and videos, drops other files, adds file://', () => {
    const share = pendingShareFromIntent({
      text: null,
      webUrl: null,
      type: 'media',
      files: [
        file('/tmp/a.jpg', 'image/jpeg'),
        file('content://b.mp4', 'video/mp4'),
        file('/tmp/c.pdf', 'application/pdf'),
      ],
    } as any);
    expect(share?.media.map((m) => [m.type, m.uri])).toEqual([
      ['image', 'file:///tmp/a.jpg'],
      ['video', 'content://b.mp4'],
    ]);
    expect(share?.text).toBeNull();
  });

  it('keeps text / url and returns null for empty intents', () => {
    expect(pendingShareFromIntent({ text: ' hi https://x.co ', webUrl: 'https://x.co', files: null, type: 'weburl' } as any)?.text)
      .toBe('hi https://x.co');
    expect(pendingShareFromIntent({ text: null, webUrl: 'https://x.co', files: null, type: 'weburl' } as any)?.text)
      .toBe('https://x.co');
    expect(pendingShareFromIntent({ text: null, webUrl: null, files: null, type: null } as any)).toBeNull();
  });
});

describe('pending share slot', () => {
  afterEach(() => clearIncomingShare());

  it('is consumed only by the assigned group, once', () => {
    setIncomingShare({ text: 'hello', media: [] });
    expect(consumeShareForGroup('g1')).toBeNull();
    assignIncomingShareToGroup('g1');
    expect(consumeShareForGroup('g2')).toBeNull();
    expect(consumeShareForGroup('g1')?.text).toBe('hello');
    expect(consumeShareForGroup('g1')).toBeNull();
    expect(peekIncomingShare()).toBeNull();
  });
});
