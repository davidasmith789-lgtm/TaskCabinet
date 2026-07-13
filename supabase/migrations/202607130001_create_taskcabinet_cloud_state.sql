create table if not exists public.taskcabinet_cloud_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  schema_version integer not null default 1 check (schema_version > 0),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

alter table public.taskcabinet_cloud_state enable row level security;

create policy "Users can read their own TaskCabinet state"
  on public.taskcabinet_cloud_state for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can create their own TaskCabinet state"
  on public.taskcabinet_cloud_state for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update their own TaskCabinet state"
  on public.taskcabinet_cloud_state for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own TaskCabinet state"
  on public.taskcabinet_cloud_state for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.taskcabinet_cloud_state from anon;
grant select, insert, update, delete on public.taskcabinet_cloud_state to authenticated;

comment on table public.taskcabinet_cloud_state is 'One versioned, RLS-protected TaskCabinet account snapshot per Supabase Auth user. Device push state is excluded.';
