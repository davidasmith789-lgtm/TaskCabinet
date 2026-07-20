with community_objects as (
  select 'table'::text as object_type, schemaname as schema_name, tablename as object_name, null::text as parent_name
  from pg_tables where schemaname = 'public' and tablename like 'community%'
  union all
  select 'function', n.nspname, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', null
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (p.proname like 'community%' or p.proname in ('is_community_moderator', 'moderate_community_post'))
  union all
  select 'trigger', event_object_schema, trigger_name, event_object_table
  from information_schema.triggers
  where event_object_schema = 'public' and (trigger_name like 'community%' or event_object_table like 'community%')
  union all
  select 'index', schemaname, indexname, tablename
  from pg_indexes where schemaname = 'public' and (indexname like 'community%' or tablename like 'community%')
  union all
  select 'policy', schemaname, policyname, tablename
  from pg_policies where schemaname = 'public' and tablename like 'community%'
  union all
  select 'type', n.nspname, t.typname, null
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname like 'community%'
)
select object_type, schema_name, object_name, parent_name
from community_objects
order by object_type, schema_name, object_name, parent_name;
