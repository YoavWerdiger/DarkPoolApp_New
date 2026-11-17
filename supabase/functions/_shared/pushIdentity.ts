/**
 * מבנה אחיד לכל הפושים (כמו וואטסאפ): תמונה גדולה של "השולח" + אייקון DarkPool קטן בפינה.
 *
 * ב-iOS ה-Notification Service Extension בונה מזה Communication Notification
 * (INSendMessageIntent). השרת רק מסמן את הפוש ומוסיף לו "זהות שולח":
 *   data.push_style   = 'communication'
 *   data.sender_display = מי "שלח" (שם הקבוצה / מקור החדשה / הטיקר / האדם)
 *   data.avatar_url   = התמונה הגדולה (תמונת קבוצה / לוגו טיקר / דיוקן / אייקון DarkPool)
 *   data.conversation_id = שרשור (כל פושי אותו טיקר/מקור יחד)
 *   mutableContent    = true (כדי שההרחבה תרוץ)
 * תמונה מצורפת (למשל תמונת החדשה) נשארת ב-data.image / richContent.image ומוצגת בנוסף.
 */

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');

/** אייקון DarkPool ריבועי (אווטאר ברירת מחדל) */
export const DARKPOOL_PUSH_AVATAR = `${SUPABASE_URL}/storage/v1/object/public/app-media/branding/push-avatar.png`;

/** אותו מזהה ציבורי שבאפליקציה (config/publicEnv.ts) */
const BRANDFETCH_CLIENT_ID = Deno.env.get('BRANDFETCH_CLIENT_ID') ?? '1idgv-PUKssFHXQBcKA';

export function tickerLogoUrl(symbol: unknown): string | null {
  let s = String(symbol ?? '').trim().replace(/\.US$/i, '').toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
  if (s.startsWith('-')) s = s.slice(1);
  if (!s) return null;
  const crypto = /^([A-Z0-9]{2,10})(?:-(?:USD|USDT|USDC)|USDT|USDC)$/.exec(s);
  const route = crypto ? `crypto/${encodeURIComponent(crypto[1])}` : `ticker/${encodeURIComponent(s)}`;
  const q = new URLSearchParams({ c: BRANDFETCH_CLIENT_ID, theme: 'light', fallback: 'lettermark' });
  return `https://cdn.brandfetch.io/${route}/icon?${q.toString()}`;
}

type PushIdentity = { sender: string; avatar: string; conversation: string };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

/** זהות השולח לפי סוג הפוש. `override` מנצח (למשל דיוקן שנשלף מהמסד). */
export function pushIdentityFor(
  data: Record<string, unknown>,
  override: Partial<PushIdentity> = {},
): PushIdentity {
  const type = str(data.notificationType) || str(data.type) || str(data.kind);
  const ticker = str(data.ticker) || str(data.symbol) || str(data.code);
  const logo = ticker ? tickerLogoUrl(ticker) : null;
  let id: PushIdentity;
  switch (type) {
    case 'chat_message':
      id = {
        sender: str(data.group_name) || str(data.sender_name) || 'DarkPool',
        avatar: str(data.avatar_url) || DARKPOOL_PUSH_AVATAR,
        conversation: `chat-${str(data.group_id)}`,
      };
      break;
    case 'news':
      id = { sender: str(data.source) || 'DarkPool · חדשות', avatar: DARKPOOL_PUSH_AVATAR, conversation: 'darkpool-news' };
      break;
    case 'earnings':
    case 'earnings_result':
      id = {
        sender: ticker || str(data.company_name) || 'DarkPool · דוחות',
        avatar: logo || DARKPOOL_PUSH_AVATAR,
        conversation: ticker ? `ticker-${ticker}` : 'darkpool-earnings',
      };
      break;
    case 'watchlist_alert':
    case 'dark_pool_alert':
    case 'dark_pool_signal':
      id = {
        sender: ticker || 'DarkPool',
        avatar: logo || DARKPOOL_PUSH_AVATAR,
        conversation: ticker ? `ticker-${ticker}` : 'darkpool-alerts',
      };
      break;
    case 'dark_pool_feed_trade':
    case 'dark_pool_person_trade':
    case 'dark_pool_fund_13f':
      id = {
        sender: str(data.person_name) || 'DarkPool',
        avatar: DARKPOOL_PUSH_AVATAR,
        conversation: str(data.person_id) ? `person-${str(data.person_id)}` : 'darkpool-feed',
      };
      break;
    case 'economic_calendar':
    case 'economic_result':
      id = { sender: 'DarkPool · יומן כלכלי', avatar: DARKPOOL_PUSH_AVATAR, conversation: 'darkpool-economic' };
      break;
    case 'fear_greed':
      id = { sender: 'Fear & Greed', avatar: DARKPOOL_PUSH_AVATAR, conversation: 'darkpool-fear-greed' };
      break;
    default:
      id = { sender: 'DarkPool', avatar: logo || DARKPOOL_PUSH_AVATAR, conversation: `darkpool-${type || 'general'}` };
  }
  return {
    sender: override.sender || id.sender,
    avatar: override.avatar || id.avatar,
    conversation: override.conversation || id.conversation,
  };
}

/** מסמן הודעת Expo כ-Communication Notification (משאיר את כל השאר כמו שהוא). */
export function withPushIdentity<T extends Record<string, unknown>>(
  message: T,
  override: Partial<PushIdentity> = {},
): T {
  const data = (message.data as Record<string, unknown> | undefined) ?? {};
  const identity = pushIdentityFor(data, override);
  return {
    ...message,
    mutableContent: true,
    data: {
      ...data,
      push_style: 'communication',
      sender_display: identity.sender,
      avatar_url: identity.avatar,
      conversation_id: identity.conversation,
    },
  };
}
