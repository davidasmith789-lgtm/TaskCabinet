-- Give the exact developer account Community moderation privileges server-side.
-- Shared decks remain readable by every authenticated user through the existing
-- active/shared RLS policies and RPC guards.
create or replace function public.is_community_moderator(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select check_user_id is not null
    and check_user_id = auth.uid()
    and (
      exists (select 1 from public.community_moderators where user_id = check_user_id)
      or exists (
        select 1
        from auth.users developer
        where developer.id = check_user_id
          and lower(developer.email) = 'purplxr@gmail.com'
      )
    );
$$;

revoke all on function public.is_community_moderator(uuid) from public;
grant execute on function public.is_community_moderator(uuid) to authenticated;

drop policy if exists posts_delete on public.community_posts;
create policy posts_delete on public.community_posts
for delete to authenticated
using (author_id = auth.uid() or public.is_community_moderator(auth.uid()));
