import i18n from '../../lib/i18n';
/**
 * קטגוריות אימוג'י לשיט ריאקציות (סגנון וואטסאפ).
 * keywords / aliases — חיפוש בעברית ובאנגלית בצד הלקוח.
 */

export type ReactionEmojiCategory = {
  id: string;
  title: string;
  emojis: string[];
  keywords?: string[];
};

const EMOJI_ALIASES: Record<string, string[]> = {
  '👍': [i18n.t('auto.components__chat__reactionEmojiData.s1'), i18n.t('auto.components__chat__reactionEmojiData.s2'), 'like', 'thumb', 'thumbs'],
  '👎': [i18n.t('auto.components__chat__reactionEmojiData.s3'), i18n.t('auto.components__chat__reactionEmojiData.s4'), 'dislike'],
  '❤️': [i18n.t('auto.components__chat__reactionEmojiData.s5'), i18n.t('auto.components__chat__reactionEmojiData.s6'), 'heart', 'love'],
  '🧡': [i18n.t('auto.components__chat__reactionEmojiData.s5'), i18n.t('auto.components__chat__reactionEmojiData.s7')],
  '💛': [i18n.t('auto.components__chat__reactionEmojiData.s5'), i18n.t('auto.components__chat__reactionEmojiData.s8')],
  '💚': [i18n.t('auto.components__chat__reactionEmojiData.s5'), i18n.t('auto.components__chat__reactionEmojiData.s9')],
  '💙': [i18n.t('auto.components__chat__reactionEmojiData.s5'), i18n.t('auto.components__chat__reactionEmojiData.s10')],
  '💜': [i18n.t('auto.components__chat__reactionEmojiData.s5'), i18n.t('auto.components__chat__reactionEmojiData.s11')],
  '🖤': [i18n.t('auto.components__chat__reactionEmojiData.s5'), i18n.t('auto.components__chat__reactionEmojiData.s12')],
  '🤍': [i18n.t('auto.components__chat__reactionEmojiData.s5'), i18n.t('auto.components__chat__reactionEmojiData.s13')],
  '💔': [i18n.t('auto.components__chat__reactionEmojiData.s14'), i18n.t('auto.components__chat__reactionEmojiData.s15'), 'broken'],
  '😂': [i18n.t('auto.components__chat__reactionEmojiData.s16'), 'lol', 'laugh'],
  '🤣': [i18n.t('auto.components__chat__reactionEmojiData.s16'), 'rofl'],
  '😮': [i18n.t('auto.components__chat__reactionEmojiData.s17'), i18n.t('auto.components__chat__reactionEmojiData.s18'), 'wow', 'surprised'],
  '😢': [i18n.t('auto.components__chat__reactionEmojiData.s19'), i18n.t('auto.components__chat__reactionEmojiData.s20'), 'sad', 'cry'],
  '😡': [i18n.t('auto.components__chat__reactionEmojiData.s21'), i18n.t('auto.components__chat__reactionEmojiData.s22'), 'angry'],
  '🙏': [i18n.t('auto.components__chat__reactionEmojiData.s23'), i18n.t('auto.components__chat__reactionEmojiData.s24'), 'pray', 'thanks'],
  '🔥': [i18n.t('auto.components__chat__reactionEmojiData.s25'), i18n.t('auto.components__chat__reactionEmojiData.s26'), 'fire', 'lit'],
  '👏': [i18n.t('auto.components__chat__reactionEmojiData.s27'), i18n.t('auto.components__chat__reactionEmojiData.s28'), 'clap'],
  '🎉': [i18n.t('auto.components__chat__reactionEmojiData.s29'), i18n.t('auto.components__chat__reactionEmojiData.s30'), 'party', 'celebrate'],
  '💯': [i18n.t('auto.components__chat__reactionEmojiData.s31'), i18n.t('auto.components__chat__reactionEmojiData.s32'), 'hundred'],
  '✨': [i18n.t('auto.components__chat__reactionEmojiData.s33'), 'sparkle'],
  '💪': [i18n.t('auto.components__chat__reactionEmojiData.s34'), i18n.t('auto.components__chat__reactionEmojiData.s35'), 'strong'],
  '😍': [i18n.t('auto.components__chat__reactionEmojiData.s36'), i18n.t('auto.components__chat__reactionEmojiData.s37')],
  '🤔': [i18n.t('auto.components__chat__reactionEmojiData.s38'), 'hmm', 'think'],
  '😎': [i18n.t('auto.components__chat__reactionEmojiData.s39'), 'cool'],
  '🥳': [i18n.t('auto.components__chat__reactionEmojiData.s30'), 'party'],
  '😱': [i18n.t('auto.components__chat__reactionEmojiData.s40'), 'shock'],
  '🤯': [i18n.t('auto.components__chat__reactionEmojiData.s41'), 'mind blown'],
  '🥺': [i18n.t('auto.components__chat__reactionEmojiData.s42'), 'puppy'],
  '👀': [i18n.t('auto.components__chat__reactionEmojiData.s43'), i18n.t('auto.components__chat__reactionEmojiData.s44'), 'eyes'],
  '💀': [i18n.t('auto.components__chat__reactionEmojiData.s45'), 'dead'],
  '🚀': [i18n.t('auto.components__chat__reactionEmojiData.s46'), 'rocket'],
  '📈': [i18n.t('auto.components__chat__reactionEmojiData.s47'), i18n.t('auto.components__chat__reactionEmojiData.s48'), 'chart', 'up'],
  '📉': [i18n.t('auto.components__chat__reactionEmojiData.s49'), i18n.t('auto.components__chat__reactionEmojiData.s48'), 'down'],
  '💰': [i18n.t('auto.components__chat__reactionEmojiData.s50'), 'money'],
  '💎': [i18n.t('auto.components__chat__reactionEmojiData.s51'), 'diamond'],
  '✅': [i18n.t('auto.components__chat__reactionEmojiData.s52'), i18n.t('auto.components__chat__reactionEmojiData.s53'), 'check'],
  '❌': [i18n.t('auto.components__chat__reactionEmojiData.s54'), i18n.t('auto.components__chat__reactionEmojiData.s55'), 'x'],
  '⭐': [i18n.t('auto.components__chat__reactionEmojiData.s56'), 'star'],
  '🌟': [i18n.t('auto.components__chat__reactionEmojiData.s56'), 'star'],
  '🇮🇱': [i18n.t('auto.components__chat__reactionEmojiData.s57'), 'israel', 'flag'],
};

export function emojiSearchHaystack(emoji: string, categoryTitle: string): string {
  const aliases = EMOJI_ALIASES[emoji] ?? [];
  return `${emoji} ${categoryTitle} ${aliases.join(' ')}`.toLowerCase();
}

export function dedupeEmojis(emojis: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emojis) {
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export const REACTION_EMOJI_CATEGORIES: ReactionEmojiCategory[] = [
  {
    id: 'smileys',
    title: i18n.t('auto.components__chat__reactionEmojiData.s58'),
    keywords: [i18n.t('auto.components__chat__reactionEmojiData.s59'), i18n.t('auto.components__chat__reactionEmojiData.s60'), 'smiley', 'face'],
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚',
      '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
      '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄',
      '😬', '😮\u200d💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒',
      '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳',
      '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯',
      '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭',
      '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
      '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺',
      '👻', '👽', '👾', '🤖',
    ],
  },
  {
    id: 'gestures',
    title: i18n.t('auto.components__chat__reactionEmojiData.s61'),
    keywords: [i18n.t('auto.components__chat__reactionEmojiData.s62'), i18n.t('auto.components__chat__reactionEmojiData.s63'), 'gesture', 'hand'],
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
      '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
      '🙏', '✍️', '💅', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
      '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄',
      '💋',
    ],
  },
  {
    id: 'hearts',
    title: i18n.t('auto.components__chat__reactionEmojiData.s64'),
    keywords: [i18n.t('auto.components__chat__reactionEmojiData.s5'), i18n.t('auto.components__chat__reactionEmojiData.s6'), 'heart', 'love'],
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💯',
      '💥', '💫', '💦', '💨', '💣', '💬', '💭', '💤',
    ],
  },
  {
    id: 'animals',
    title: i18n.t('auto.components__chat__reactionEmojiData.s65'),
    keywords: [i18n.t('auto.components__chat__reactionEmojiData.s66'), i18n.t('auto.components__chat__reactionEmojiData.s67'), 'animal', 'nature'],
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻\u200d❄️', '🐨',
      '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
      '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
      '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎',
      '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟',
      '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧',
      '🐘', '🦣', '🦏', '🦛', '🐪', '🐫', '🦒', '🦘', '🦬', '🐄',
      '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🐈',
      '🐈\u200d⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝',
      '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔', '🌵',
      '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🍃', '🍂',
      '🍁', '🍄', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻',
      '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑',
      '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐',
      '🌟', '✨', '⚡', '☄️', '💥', '🔥', '🌪️', '🌈', '☀️', '🌤️',
      '⛅', '☁️', '🌧️', '⛈️', '🌨️', '❄️', '☃️', '⛄', '💨', '💧',
      '💦', '☔', '🌊',
    ],
  },
  {
    id: 'food',
    title: i18n.t('auto.components__chat__reactionEmojiData.s68'),
    keywords: [i18n.t('auto.components__chat__reactionEmojiData.s69'), i18n.t('auto.components__chat__reactionEmojiData.s70'), 'food', 'drink'],
    emojis: [
      '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏',
      '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑',
      '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄',
      '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🫓', '🥨', '🥯',
      '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕',
      '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲',
      '🫕', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙',
      '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮',
      '🍡', '🥟', '🥠', '🥡', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂',
      '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛',
      '☕', '🫖', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻',
      '🥂', '🥃', '🥤', '🧋', '🧃', '🧉', '🧊',
    ],
  },
  {
    id: 'activity',
    title: i18n.t('auto.components__chat__reactionEmojiData.s71'),
    keywords: [i18n.t('auto.components__chat__reactionEmojiData.s72'), i18n.t('auto.components__chat__reactionEmojiData.s73'), 'activity', 'sport'],
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
      '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏆', '🥇', '🥈', '🥉',
      '🏅', '🎖️', '🎫', '🎟️', '🎪', '🎭', '🩰', '🎨', '🎬', '🎤',
      '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲',
      '♟️', '🎯', '🎳', '🎮', '🎰', '🧩',
    ],
  },
  {
    id: 'travel',
    title: i18n.t('auto.components__chat__reactionEmojiData.s74'),
    keywords: [i18n.t('auto.components__chat__reactionEmojiData.s75'), i18n.t('auto.components__chat__reactionEmojiData.s76'), 'travel', 'car'],
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
      '🛻', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨',
      '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞',
      '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️',
      '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵',
      '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥',
      '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢',
      '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻',
      '🏕️', '⛺', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨',
      '🏪', '🏫', '🏬', '🏭', '💒', '⛪', '🕌', '🛕', '🕍', '⛩️',
      '🕋',
    ],
  },
  {
    id: 'objects',
    title: i18n.t('auto.components__chat__reactionEmojiData.s77'),
    keywords: [i18n.t('auto.components__chat__reactionEmojiData.s78'), 'object', 'money'],
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🕹️', '💽',
      '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📞', '☎️',
      '📟', '📠', '📺', '📻', '🎙️', '⏱️', '⏲️', '⏰', '⌛', '⏳',
      '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '💸', '💵', '💴', '💶',
      '💷', '🪙', '💰', '💳', '💎', '⚖️', '🧰', '🪛', '🔧', '🔨',
      '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🔫', '💣', '🪓', '🔪',
      '🗡️', '⚔️', '🛡️', '🔮', '💈', '🔭', '🔬', '💊', '💉', '🩸',
      '🧬', '🦠', '🧫', '🧪', '🧹', '🧺', '🧻', '🚽', '🚿', '🛁',
      '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🔑', '🗝️', '🚪', '🪑',
      '🛋️', '🛏️', '🧸', '🖼️', '🛍️', '🛒', '🎁', '🎈', '🎀', '🪄',
      '🪅', '🎊', '🎉', '🏮', '✉️', '📩', '📨', '📧', '💌', '📥',
      '📤', '📦', '🏷️', '📕', '📗', '📘', '📙', '📚', '📓', '📒',
      '📃', '📜', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️',
      '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂',
      '🗂️', '🗞️', '📰', '✏️', '✒️', '🖋️', '🖊️', '🖌️', '🖍️', '📝',
      '💼',
    ],
  },
  {
    id: 'symbols',
    title: i18n.t('auto.components__chat__reactionEmojiData.s79'),
    keywords: [i18n.t('auto.components__chat__reactionEmojiData.s80'), i18n.t('auto.components__chat__reactionEmojiData.s81'), 'symbol'],
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '💯', '💢', '💥', '💫', '💦', '💨', '💣', '💬', '💭', '💤',
      '💮', '♨️', '💈', '🛑', '⚠️', '🚸', '⛔', '🚫', '🚳', '🚭',
      '🚯', '🚱', '🚷', '📵', '🔞', '☢️', '☣️', '⬆️', '↗️', '➡️',
      '↘️', '⬇️', '↙️', '⬅️', '↖️', '↕️', '↔️', '↩️', '↪️', '⤴️',
      '⤵️', '🔃', '🔄', '🔙', '🔚', '🔛', '🔜', '🔝', '🛐', '⚛️',
      '🕉️', '✡️', '☸️', '☯️', '✝️', '☦️', '☪️', '☮️', '🕎', '🔯',
      '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑',
      '♒', '♓', '⛎', '🔀', '🔁', '🔂', '▶️', '⏩', '⏭️', '⏯️',
      '◀️', '⏪', '⏮️', '🔼', '⏫', '🔽', '⏬', '⏸️', '⏹️', '⏺️',
      '⏏️', '🎦', '🔅', '🔆', '📶', '📳', '📴', '♀️', '♂️', '⚧️',
      '✖️', '➕', '➖', '➗', '♾️', '‼️', '⁉️', '❓', '❔', '❕',
      '❗', '〰️', '💱', '💲', '⚕️', '♻️', '⚜️', '🔱', '📛', '🔰',
      '⭕', '✅', '☑️', '✔️', '❌', '❎', '➰', '➿', '〽️', '✳️',
      '✴️', '❇️', '©️', '®️', '™️', '🔴', '🟠', '🟡', '🟢', '🔵',
      '🟣', '🟤', '⚫', '⚪', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪',
      '🟫', '⬛', '⬜', '◼️', '◻️', '◾', '◽', '▪️', '▫️', '🔶',
      '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲', '🏁',
      '🚩', '🎌', '🏴', '🏳️', '🏳️\u200d🌈', '🏳️\u200d⚧️', '🏴\u200d☠️', '🇮🇱', '🇺🇸', '🇬🇧',
      '🇪🇺',
    ],
  },
];
