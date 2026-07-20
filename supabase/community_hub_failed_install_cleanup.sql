begin;

-- These are the only tables introduced by the failed Community Hub migration.
-- CASCADE removes only their dependent Community indexes, triggers, and policies.
drop table if exists public.community_post_reports cascade;
drop table if exists public.community_post_saves cascade;
drop table if exists public.community_post_votes cascade;
drop table if exists public.community_posts cascade;
drop table if exists public.community_moderators cascade;

drop function if exists public.moderate_community_post(uuid, text, boolean);
drop function if exists public.community_moderation_queue();
drop function if exists public.community_search_posts(text, text, text, integer, integer, boolean);
drop function if exists public.community_post_quota();
drop function if exists public.create_community_post(text, text, text, text, text[]);
drop function if exists public.community_auto_hide();
drop function if exists public.community_protect_status();
drop function if exists public.community_touch_updated_at();
drop function if exists public.community_prepare_post();
drop function if exists public.is_community_moderator(uuid);
drop function if exists public.community_tags_valid(text[]);

-- pg_trgm is intentionally retained because another application feature may use it.
commit;
