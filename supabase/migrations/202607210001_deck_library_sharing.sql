begin;

alter table public.flashcard_decks drop constraint if exists flashcard_decks_visibility_check;
alter table public.flashcard_decks add constraint flashcard_decks_visibility_check check (visibility in ('private','shared','public'));

create table public.flashcard_deck_shares (
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  shared_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (deck_id, recipient_id),
  check (recipient_id <> shared_by)
);
alter table public.flashcard_deck_shares enable row level security;
create policy flash_deck_shares_read on public.flashcard_deck_shares for select to authenticated using (recipient_id=auth.uid() or shared_by=auth.uid());

create or replace function public.flashcard_library_decks(library_section text default 'all',search_text text default '',course_filter text default null,sort_by text default 'updated',page_number int default 0,page_size int default 20)
returns table(id uuid,owner_id uuid,title text,course_name text,description text,topic_tags text[],visibility text,status text,target_date date,is_starred boolean,updated_at timestamptz,card_count bigint,understanding_percent int)
language sql stable security definer set search_path=public,pg_temp as $$
  select d.id,d.owner_id,d.title,d.course_name,d.description,d.topic_tags,d.visibility,d.status,d.target_date,
    exists(select 1 from public.flashcard_deck_favorites f where f.deck_id=d.id and f.user_id=auth.uid()),d.updated_at,
    count(distinct c.id),coalesce(round(100.0*count(distinct c.id) filter(where p.confidence_status in('Familiar','Strong'))/nullif(count(distinct c.id),0)),0)::int
  from public.flashcard_decks d
  left join public.flashcards c on c.deck_id=d.id
  left join public.flashcard_user_progress p on p.card_id=c.id and p.user_id=auth.uid()
  where d.status='active'
    and (d.owner_id=auth.uid() or d.visibility in('shared','public') or exists(select 1 from public.flashcard_deck_shares sh where sh.deck_id=d.id and sh.recipient_id=auth.uid()))
    and (library_section='all'
      or library_section='mine' and d.owner_id=auth.uid()
      or library_section='shared' and d.owner_id<>auth.uid() and exists(select 1 from public.flashcard_deck_shares sh where sh.deck_id=d.id and sh.recipient_id=auth.uid())
      or library_section='public' and d.visibility in('shared','public')
      or library_section='starred' and exists(select 1 from public.flashcard_deck_favorites f where f.deck_id=d.id and f.user_id=auth.uid()))
    and (search_text='' or d.search_document@@websearch_to_tsquery('english',search_text))
    and (course_filter is null or d.course_name=course_filter)
  group by d.id
  order by case when sort_by='alpha' then d.title end, d.updated_at desc
  limit least(page_size,50) offset greatest(page_number,0)*least(page_size,50)
$$;

create or replace function public.set_flashcard_deck_star(target_deck_id uuid,starred boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.flashcard_decks d where d.id=target_deck_id and d.status='active' and (d.owner_id=auth.uid() or d.visibility in('shared','public') or exists(select 1 from public.flashcard_deck_shares s where s.deck_id=d.id and s.recipient_id=auth.uid()))) then raise exception 'Deck is not available'; end if;
  if starred then insert into public.flashcard_deck_favorites(deck_id,user_id) values(target_deck_id,auth.uid()) on conflict do nothing;
  else delete from public.flashcard_deck_favorites where deck_id=target_deck_id and user_id=auth.uid(); end if;
end$$;

create or replace function public.share_flashcard_deck(target_deck_id uuid,recipient_email text) returns void language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare recipient uuid;
begin
  if not exists(select 1 from public.flashcard_decks where id=target_deck_id and owner_id=auth.uid()) then raise exception 'Only the deck owner can share it'; end if;
  select id into recipient from auth.users where lower(email)=lower(btrim(recipient_email));
  if recipient is null or recipient=auth.uid() then raise exception 'No other GlowDocket account uses that email'; end if;
  insert into public.flashcard_deck_shares(deck_id,recipient_id,shared_by) values(target_deck_id,recipient,auth.uid()) on conflict do nothing;
end$$;

create or replace function public.flashcard_get_deck(target_deck_id uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
select to_jsonb(d)||jsonb_build_object('cards',coalesce((select jsonb_agg(to_jsonb(c) order by c.position) from public.flashcards c where c.deck_id=d.id),'[]'::jsonb)) from public.flashcard_decks d where d.id=target_deck_id and (d.owner_id=auth.uid() or d.visibility in('shared','public') and d.status='active' or exists(select 1 from public.flashcard_deck_shares s where s.deck_id=d.id and s.recipient_id=auth.uid()) or public.is_community_moderator(auth.uid()))
$$;

create or replace function public.set_flashcard_star(target_card_id uuid,starred boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.flashcards c join public.flashcard_decks d on d.id=c.deck_id where c.id=target_card_id and (d.owner_id=auth.uid() or d.visibility in('shared','public') and d.status='active' or exists(select 1 from public.flashcard_deck_shares s where s.deck_id=d.id and s.recipient_id=auth.uid()))) then raise exception 'Not authorized'; end if;
  insert into public.flashcard_user_progress(user_id,card_id,is_starred) values(auth.uid(),target_card_id,starred) on conflict(user_id,card_id) do update set is_starred=excluded.is_starred,updated_at=now();
end$$;

create or replace function public.complete_shared_flashcard_session(target_deck_id uuid,started_at timestamptz,reviews jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare sid uuid; item jsonb; rating text;
begin
  if jsonb_array_length(reviews) not between 1 and 500 or not exists(select 1 from public.flashcard_deck_shares where deck_id=target_deck_id and recipient_id=auth.uid()) then raise exception 'Shared deck is not available'; end if;
  insert into public.flashcard_study_sessions(user_id,deck_id,started_at,completed_at,cards_reviewed,session_completed) values(auth.uid(),target_deck_id,started_at,now(),jsonb_array_length(reviews),true) returning id into sid;
  for item in select * from jsonb_array_elements(reviews) loop
    if not exists(select 1 from public.flashcards where id=(item->>'card_id')::uuid and deck_id=target_deck_id) then raise exception 'Card does not belong to deck'; end if;
    rating=item->>'rating';
    insert into public.flashcard_user_progress(user_id,card_id,review_count,again_count,hard_count,good_count,easy_count,last_rating,confidence_status,last_reviewed_at)
    values(auth.uid(),(item->>'card_id')::uuid,1,(rating='Again')::int,(rating='Hard')::int,(rating='Good')::int,(rating='Easy')::int,rating,case when rating in('Again','Hard') then 'Learning' else 'Familiar' end,now())
    on conflict(user_id,card_id) do update set review_count=flashcard_user_progress.review_count+1,again_count=flashcard_user_progress.again_count+(rating='Again')::int,hard_count=flashcard_user_progress.hard_count+(rating='Hard')::int,good_count=flashcard_user_progress.good_count+(rating='Good')::int,easy_count=flashcard_user_progress.easy_count+(rating='Easy')::int,last_rating=rating,confidence_status=case when rating in('Again','Hard') then 'Learning' else 'Familiar' end,last_reviewed_at=now(),updated_at=now();
  end loop;
  return jsonb_build_object('session_id',sid,'xp_earned',0,'total_xp',coalesce((select sum(xp) from public.flashcard_xp_events where user_id=auth.uid()),0),'badges',coalesce((select jsonb_agg(badge_id) from public.flashcard_badge_unlocks where user_id=auth.uid()),'[]'::jsonb),'meaningful',true);
end$$;

revoke all on function public.flashcard_library_decks(text,text,text,text,int,int),public.set_flashcard_deck_star(uuid,boolean),public.share_flashcard_deck(uuid,text),public.complete_shared_flashcard_session(uuid,timestamptz,jsonb) from public;
grant execute on function public.flashcard_library_decks(text,text,text,text,int,int),public.set_flashcard_deck_star(uuid,boolean),public.share_flashcard_deck(uuid,text),public.complete_shared_flashcard_session(uuid,timestamptz,jsonb) to authenticated;
commit;
