-- תצוגת «הודעה אחרונה» ברשימת הצ'אטים: צירופים/הקלטות נשמרו כ-JSON חתוך (LEFT 100) → טקסט גולמי ברשימה.
-- עכשיו: טקסט נקי («📎 כותרת», «🎤 הודעה קולית», «טרייד · TSLA»...). + תיקון חד-פעמי לקיימים.
create or replace function public.chat_message_preview_text(p_type text, p_content text)
returns text language plpgsql immutable set search_path = public as $$
declare
  v jsonb;
  t text := btrim(coalesce(p_content, ''));
  v_title text;
begin
  if left(t, 1) = '{' then
    begin
      v := t::jsonb;
    exception when others then
      v := null;
    end;
    if v is not null then
      if v ? 'attachment' then
        v_title := nullif(btrim(coalesce(v->>'caption', '')), '');
        if v_title is null then
          v_title := nullif(btrim(coalesce(v->'attachment'->'preview'->>'title', '')), '');
          return '📎 ' || coalesce(v_title, 'שיתוף');
        end if;
        return v_title;
      end if;
      if v ? 'waveform' or v ? 'waveformData' then
        return '🎤 הודעה קולית';
      end if;
      if v ? 'trade' then
        return 'טרייד' || coalesce(' · ' || nullif(v->'trade'->>'symbol', ''), '');
      end if;
    end if;
  end if;
  if t <> '' and left(t, 1) <> '{' then
    return t;
  end if;
  return case p_type
    when 'image' then '📷 תמונה'
    when 'video' then '🎥 סרטון'
    when 'audio' then '🎤 הודעה קולית'
    when 'document' then '📎 מסמך'
    when 'poll' then '📊 סקר'
    when 'trade' then 'טרייד'
    when 'entity' then '📎 שיתוף'
    else ''
  end;
end; $$;

create or replace function public.update_group_on_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.chat_groups
  set
    last_message_at = new.created_at,
    last_message_preview = left(public.chat_message_preview_text(new.message_type, new.content), 100),
    messages_count = coalesce(messages_count, 0) + 1
  where id = new.group_id;
  return new;
end; $$;

update public.chat_groups g
set last_message_preview = left((
  select public.chat_message_preview_text(m.message_type, m.content)
  from public.chat_messages m
  where m.group_id = g.id and coalesce(m.is_deleted, false) = false
  order by m.created_at desc limit 1
), 100)
where left(btrim(coalesce(g.last_message_preview, '')), 1) = '{';
