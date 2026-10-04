import { isAnnouncementGroup } from './isAnnouncementGroup';

/**
 * Who may post in admin-only / announcements chats.
 * - Group chat admin (`chat_group_members.role = admin`)
 * - App community admin (`users.subscription_role` admin / super_admin)
 * Members stay blocked.
 */
export function canSendInAdminOnlyChat(opts: {
  isGroupAdmin?: boolean | null;
  isAppAdmin?: boolean | null;
  myRole?: string | null;
}): boolean {
  if (opts.isAppAdmin) return true;
  if (opts.isGroupAdmin) return true;
  const role = String(opts.myRole || '').toLowerCase();
  return role === 'admin' || role === 'owner';
}

/** הכרזות / קבוצה שקטה → רק מנהלים; אחרת כל חבר. */
export function canPostInGroup(
  group: {
    id: string;
    name?: string | null;
    my_role?: string | null;
    settings?: { onlyAdminsCanSend?: boolean; is_announcement?: boolean } | null;
  },
  isAppAdmin?: boolean | null,
): boolean {
  const adminOnly = isAnnouncementGroup(group.name, group.id) || isAdminOnlySendSettings(group.settings);
  return !adminOnly || canSendInAdminOnlyChat({ isAppAdmin, myRole: group.my_role });
}

/** Group settings that mean "only admins may send". */
export function isAdminOnlySendSettings(settings?: {
  onlyAdminsCanSend?: boolean;
  is_announcement?: boolean;
} | null): boolean {
  return !!(settings?.onlyAdminsCanSend || settings?.is_announcement);
}
