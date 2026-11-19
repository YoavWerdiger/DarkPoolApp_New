-- News without a real image used to get the X account's profile picture
-- (pbs.twimg.com/profile_images/...). A news item without an image is better.

create or replace function public.app_news_clean_drop_profile_image()
returns trigger
language plpgsql
as $$
begin
  if new.img ~* '/profile_images/|cdn\.discordapp\.com/avatars/' then
    new.img := null;
  end if;
  if new.image_url ~* '/profile_images/|cdn\.discordapp\.com/avatars/' then
    new.image_url := null;
  end if;
  return new;
end;
$$;

drop trigger if exists app_news_clean_drop_profile_image on public.app_news_clean;
create trigger app_news_clean_drop_profile_image
  before insert or update of img, image_url on public.app_news_clean
  for each row execute function public.app_news_clean_drop_profile_image();

-- existing rows
update public.app_news_clean
   set img = case when img ~* '/profile_images/|cdn\.discordapp\.com/avatars/' then null else img end,
       image_url = case when image_url ~* '/profile_images/|cdn\.discordapp\.com/avatars/' then null else image_url end
 where img ~* '/profile_images/|cdn\.discordapp\.com/avatars/'
    or image_url ~* '/profile_images/|cdn\.discordapp\.com/avatars/';
