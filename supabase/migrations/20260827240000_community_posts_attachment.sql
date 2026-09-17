-- Multiverse MVP: embeddable entity snapshot on community posts
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS attachment jsonb;

COMMENT ON COLUMN public.community_posts.attachment IS
  'ShareableAttachment snapshot (v1) — person_profile | journal_trade | news_article';
