-- תור הדיווחים (פריט 6): אדמין מסיר תוכן מדווח מכל סוג בקריאה אחת, בצד השרת,
-- ומסמן את הדיווח כ«טופל». לא תלוי בהרשאות RLS של כל טבלה בנפרד.
create or replace function public.admin_remove_reported_content(p_report_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  r public.content_reports%rowtype;
begin
  if v_uid is null or not public.is_app_admin(v_uid) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into r from public.content_reports where id = p_report_id for update;
  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  if r.target_type = 'message' then
    -- כמו «מחק לכולם»: ההודעה נשארת כשורה «הודעה זו נמחקה»
    update public.chat_messages
       set is_deleted = true,
           deleted_for_everyone = true,
           deleted_at = now(),
           content = null,
           media_url = null
     where id::text = r.target_id;
  elsif r.target_type = 'post' then
    delete from public.community_posts where id::text = r.target_id;
  elsif r.target_type = 'post_reply' then
    delete from public.community_post_replies where id::text = r.target_id;
  elsif r.target_type = 'message_comment' then
    delete from public.chat_message_comments where id::text = r.target_id;
  elsif r.target_type = 'story' then
    delete from public.user_stories where id::text = r.target_id;
  elsif r.target_type = 'user' then
    -- משתמש: אין «תוכן» אחד למחוק — מסמנים כטופל; חסימה/השעיה מהפאנל
    null;
  end if;

  update public.content_reports
     set status = 'actioned', handled_by = v_uid, handled_at = now()
   where id = p_report_id
      -- כל הדיווחים על אותו תוכן נסגרים יחד
      or (target_type = r.target_type and target_id = r.target_id and status = 'open');

  return r.target_type;
end;
$$;

revoke all on function public.admin_remove_reported_content(uuid) from public, anon;
grant execute on function public.admin_remove_reported_content(uuid) to authenticated;

notify pgrst, 'reload schema';
