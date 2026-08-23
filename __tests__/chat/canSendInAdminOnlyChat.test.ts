import {
  canSendInAdminOnlyChat,
  isAdminOnlySendSettings,
} from '../../utils/canSendInAdminOnlyChat';

describe('canSendInAdminOnlyChat', () => {
  it('allows app admins', () => {
    expect(canSendInAdminOnlyChat({ isAppAdmin: true, myRole: 'member' })).toBe(true);
  });

  it('allows group admins', () => {
    expect(canSendInAdminOnlyChat({ isGroupAdmin: true })).toBe(true);
    expect(canSendInAdminOnlyChat({ myRole: 'admin' })).toBe(true);
  });

  it('blocks ordinary members', () => {
    expect(canSendInAdminOnlyChat({ myRole: 'member', isAppAdmin: false })).toBe(false);
    expect(canSendInAdminOnlyChat({})).toBe(false);
  });
});

describe('isAdminOnlySendSettings', () => {
  it('detects onlyAdminsCanSend and is_announcement', () => {
    expect(isAdminOnlySendSettings({ onlyAdminsCanSend: true })).toBe(true);
    expect(isAdminOnlySendSettings({ is_announcement: true })).toBe(true);
    expect(isAdminOnlySendSettings({ onlyAdminsCanSend: false })).toBe(false);
    expect(isAdminOnlySendSettings(null)).toBe(false);
  });
});
