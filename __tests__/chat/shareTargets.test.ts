jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn() } }));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/' }));
jest.mock('../../modules/share-targets', () => ({
  __esModule: true,
  default: { consumeShareTargetId: jest.fn(() => 'android-group') },
}));
jest.mock('../../assets/chatGroups/groupChatIcons', () => ({
  chatGroupDisplayName: (n: string) => n,
  groupChatIcon: () => null,
}));

import {
  chatShortcutUrl,
  consumeShareTargetGroupId,
  groupIdFromChatShortcutUrl,
  groupIdFromShareUrl,
} from '../../lib/shareTargets';

const { patchViewController } = require('../../plugins/withShareSuggestions');

describe('share target urls', () => {
  it('reads the iOS share extension target param', () => {
    expect(groupIdFromShareUrl('com.darkpool.app://dataUrl=com.darkpool.appShareKey?nonce=AB&target=g%2D1#media')).toBe('g-1');
    expect(groupIdFromShareUrl('com.darkpool.app://dataUrl=com.darkpool.appShareKey?nonce=AB#text')).toBeNull();
    expect(groupIdFromShareUrl('com.darkpool.app://oauth?target=x')).toBeNull();
  });

  it('falls back to the native (Android) shortcut id', () => {
    expect(consumeShareTargetGroupId('com.darkpool.app://dataUrl=k?nonce=1&target=ios-group#media')).toBe('ios-group');
    expect(consumeShareTargetGroupId(null)).toBe('android-group');
  });

  it('round-trips launcher shortcut urls', () => {
    const id = '00000000-0000-0000-0000-000000000001';
    expect(groupIdFromChatShortcutUrl(chatShortcutUrl(id))).toBe(id);
    expect(groupIdFromChatShortcutUrl('com.darkpool.app://oauth?code=1')).toBeNull();
  });
});

describe('withShareSuggestions patch', () => {
  const template = [
    'import Social',
    'import UIKit',
    'class ShareViewController: UIViewController {',
    '  let url = URL(string: "\\(shareProtocol)://dataUrl=\\(sharedKey)?nonce=\\(nonce)#\\(type)")!',
    '}',
  ].join('\n');

  it('adds the target query once', () => {
    const once = patchViewController(template);
    expect(once).toContain('import Intents');
    expect(once).toContain('?nonce=\\(nonce)\\(shareTargetQuery())#\\(type)');
    expect(once).toContain('extensionContext?.intent as? INSendMessageIntent');
    expect(patchViewController(once)).toBe(once);
  });

  it('fails loudly when the template changes', () => {
    expect(() => patchViewController('import UIKit')).toThrow(/template changed/);
  });
});
