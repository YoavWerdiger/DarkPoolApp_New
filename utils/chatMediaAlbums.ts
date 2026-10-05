import { ChatMessage, ChatMessageType as MessageType, MediaGroupItem } from '../types/chat.types';

/**
 * אלבומי מדיה (כמו וואטסאפ): כמה תמונות/סרטונים שנשלחו יחד נשמרים כהודעות נפרדות
 * עם אותו media_group_id, ומוצגים בצ'אט כבועת גריד אחת.
 *
 * הרשימה מגיעה מהחדשה לישנה (inverted). רצף צמוד של הודעות מאותו אלבום מתכווץ
 * להודעה אחת — החדשה ברצף (שומרת id/מפתח/תגובות), מסוג MEDIA_GROUP.
 */
export function collapseMediaAlbums(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length < 2) return messages;
  let changed = false;
  const out: ChatMessage[] = [];

  let i = 0;
  while (i < messages.length) {
    const head = messages[i];
    const albumId = albumIdOf(head);
    if (!albumId) {
      out.push(head);
      i += 1;
      continue;
    }
    let j = i + 1;
    while (
      j < messages.length &&
      albumIdOf(messages[j]) === albumId &&
      messages[j].sender_id === head.sender_id
    ) {
      j += 1;
    }
    const run = messages.slice(i, j);
    if (run.length < 2) {
      out.push(head);
    } else {
      out.push(buildAlbum(run));
      changed = true;
    }
    i = j;
  }
  return changed ? out : messages;
}

function albumIdOf(m: ChatMessage): string | null {
  const id = m.media_group_id;
  if (!id) return null;
  if (m.is_deleted || m.deleted_for_everyone) return null;
  if (m.message_type !== MessageType.IMAGE && m.message_type !== MessageType.VIDEO) return null;
  return id;
}

/** run: מהחדשה לישנה → בגריד מציגים בסדר השליחה (מהישנה לחדשה) */
function buildAlbum(run: ChatMessage[]): ChatMessage {
  const newest = run[0];
  const chronological = [...run].reverse();
  const anyUploading = run.some((m) => m.is_uploading);
  const caption = chronological.find((m) => (m.content || '').trim())?.content || '';

  const media_urls: MediaGroupItem[] = chronological.map((m) => ({
    id: m.id,
    url: m.media_url || '',
    type: m.message_type === MessageType.VIDEO ? 'video' : 'image',
    thumbnail_url: m.media_thumbnail_url || undefined,
    width: m.media_width || undefined,
    height: m.media_height || undefined,
    duration: m.media_duration || undefined,
  }));

  const local_media_urls = anyUploading
    ? chronological.map((m) => ({
        id: m.id,
        uri: m.local_media_uri || m.media_thumbnail_url || m.media_url || '',
        type: (m.message_type === MessageType.VIDEO ? 'video' : 'image') as 'image' | 'video',
      }))
    : undefined;

  return {
    ...newest,
    message_type: MessageType.MEDIA_GROUP,
    content: caption,
    media_urls,
    local_media_urls,
    is_uploading: anyUploading,
    is_sending: run.some((m) => m.is_sending),
    send_error: run.find((m) => m.send_error)?.send_error,
  };
}
