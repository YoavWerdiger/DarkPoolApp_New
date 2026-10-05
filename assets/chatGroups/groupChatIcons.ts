import { ImageSourcePropType } from 'react-native';

type IconKey =
  | 'announcements'
  | 'discussions'
  | 'analysis'
  | 'penny'
  | 'qa'
  | 'daytrade'
  | 'news'
  | 'swings'
  | 'alerts'
  | 'profits'
  | 'live'
  | 'israel';

const announcements = require('./announcements.png') as ImageSourcePropType;

const dark: Record<Exclude<IconKey, 'announcements'>, ImageSourcePropType> = {
  discussions: require('./dark/discussions.png'),
  analysis: require('./dark/analysis.png'),
  penny: require('./dark/penny.png'),
  qa: require('./dark/qa.png'),
  daytrade: require('./dark/daytrade.png'),
  news: require('./dark/news.png'),
  swings: require('./dark/swings.png'),
  alerts: require('./dark/alerts.png'),
  profits: require('./dark/profits.png'),
  live: require('./dark/live.png'),
  israel: require('./dark/israel.png'),
};

const light: Record<Exclude<IconKey, 'announcements'>, ImageSourcePropType> = {
  discussions: require('./light/discussions.png'),
  analysis: require('./light/analysis.png'),
  penny: require('./light/penny.png'),
  qa: require('./light/qa.png'),
  daytrade: require('./light/daytrade.png'),
  news: require('./light/news.png'),
  swings: require('./light/swings.png'),
  alerts: require('./light/alerts.png'),
  profits: require('./light/profits.png'),
  live: require('./light/live.png'),
  israel: require('./light/israel.png'),
};

/** שמות רשמיים אחרי הסרת אימוג'י — לפי שמות הקבצים בתיקיית התמונות. */
const NAME_TO_KEY: Record<string, IconKey> = {
  'הכרזות': 'announcements',
  'דיונים - כללי': 'discussions',
  'ניתוחים ורעיונות': 'analysis',
  'ניתוחים ורעיונות שלכם': 'analysis',
  'נטו ניתוחים!': 'analysis',
  'דיוני פניסטוק': 'penny',
  'דיוני - פניסטוקס': 'penny',
  'שאלות תשובות': 'qa',
  'שאלות ותשובות בשוק': 'qa',
  'מסחר יומי': 'daytrade',
  'עסקאות מסחר יומי': 'daytrade',
  'חדשות מתפרצות': 'news',
  'סווינגים והשקעות': 'swings',
  'סווינגים וסטאפים': 'swings',
  'פניסטוקס (סיכון גבוה)': 'alerts',
  'מסחר פניסטוקס - סיכון גבוה': 'alerts',
  'איתותי פניסטוקס': 'alerts',
  'רווחים והצלחות': 'profits',
  'שאלות בלייבים': 'live',
  'בורסה ישראלית': 'israel',
};

/** שם לתצוגה — כפי שנשמר ב-chat_groups (כולל אימוג׳ים, כמו בקהילת הוואטסאפ) */
export function chatGroupDisplayName(groupName?: string | null): string {
  return (groupName ?? '').replace(/\s+/g, ' ').trim();
}

function baseGroupName(groupName: string): string {
  return groupName
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D\u2049\u203C]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function keyForName(groupName: string): IconKey | undefined {
  const base = baseGroupName(groupName);
  if (NAME_TO_KEY[groupName]) return NAME_TO_KEY[groupName];
  if (NAME_TO_KEY[base]) return NAME_TO_KEY[base];
  const keys = Object.keys(NAME_TO_KEY).sort((a, b) => b.length - a.length);
  const hit = keys.find((key) => base.includes(key));
  return hit ? NAME_TO_KEY[hit] : undefined;
}

export function groupChatIcon(groupName: string, isDark: boolean): ImageSourcePropType | null {
  const key = keyForName(groupName);
  if (!key) return null;
  if (key === 'announcements') return announcements;
  return (isDark ? dark : light)[key];
}

export function groupAvatarSource(
  groupName: string,
  avatarUrl: string | null | undefined,
  isDark: boolean,
): ImageSourcePropType | null {
  return groupChatIcon(groupName, isDark) || (avatarUrl ? { uri: avatarUrl } : null);
}
