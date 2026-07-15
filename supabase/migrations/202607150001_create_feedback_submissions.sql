begin;

create table if not exists public.feedback_submissions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text null,
  message text not null,
  screenshot_path text null,
  app_version text not null,
  release_id text null,
  allow_contact boolean not null default false,
  contact_email text null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_category_allowed'
      and conrelid = 'public.feedback_submissions'::regclass
  ) then
    alter table public.feedback_submissions
      add constraint feedback_category_allowed
      check (category is null or category in ('bug', 'feature', 'usability', 'account_sync', 'notifications', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_message_valid'
      and conrelid = 'public.feedback_submissions'::regclass
  ) then
    alter table public.feedback_submissions
      add constraint feedback_message_valid
      check (char_length(btrim(message)) between 1 and 5000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_status_allowed'
      and conrelid = 'public.feedback_submissions'::regclass
  ) then
    alter table public.feedback_submissions
      add constraint feedback_status_allowed
      check (status in ('new', 'reviewing', 'planned', 'resolved', 'closed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_contact_consistent'
      and conrelid = 'public.feedback_submissions'::regclass
  ) then
    alter table public.feedback_submissions
      add constraint feedback_contact_consistent
      check ((allow_contact and contact_email is not null) or (not allow_contact and contact_email is null));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'feedback_screenshot_owned'
      and conrelid = 'public.feedback_submissions'::regclass
  ) then
    alter table public.feedback_submissions
      add constraint feedback_screenshot_owned
      check (screenshot_path is null or screenshot_path like user_id::text || '/' || id::text || '/screenshot.%');
  end if;
end
$$;

create index if not exists feedback_submissions_user_created_idx
  on public.feedback_submissions (user_id, created_at desc);

create index if not exists feedback_submissions_status_created_idx
  on public.feedback_submissions (status, created_at desc);

alter table public.feedback_submissions enable row level security;

drop policy if exists "Users can create their own feedback" on public.feedback_submissions;
create policy "Users can create their own feedback"
  on public.feedback_submissions for insert to authenticated
  with check (auth.uid() = user_id and status = 'new');

drop policy if exists "Users can read their own feedback" on public.feedback_submissions;
create policy "Users can read their own feedback"
  on public.feedback_submissions for select to authenticated
  using (auth.uid() = user_id);

revoke all on public.feedback_submissions from anon;
revoke update, delete on public.feedback_submissions from authenticated;
grant select, insert on public.feedback_submissions to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'feedback-screenshots',
  'feedback-screenshots',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their own feedback screenshots" on storage.objects;
create policy "Users can upload their own feedback screenshots"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can read their own feedback screenshots" on storage.objects;
create policy "Users can read their own feedback screenshots"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can remove their own feedback screenshots" on storage.objects;
create policy "Users can remove their own feedback screenshots"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on table public.feedback_submissions is
  'Authenticated GlowDocket feedback. Screenshots remain private in the feedback-screenshots Storage bucket.';

commit;