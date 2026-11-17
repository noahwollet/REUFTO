-- Server-only persistence. Employee authorization is performed by the verified Edge API.
create table public.reu_records (key text primary key, value jsonb not null, version uuid not null default gen_random_uuid(), updated_at timestamptz not null default now());
create table public.reu_assets (key text primary key, mime text not null, bytes bigint not null, sha256 text not null);
create table public.activity_events (id text primary key,at text not null,request_id text not null,user_id text not null,actor_email text not null,role text not null,category text not null,action text not null,phase text not null,status integer,method text not null,path text not null,demonstration integer not null default 0,details text not null default '{}');
create index activity_at on public.activity_events(at desc,id desc);
create index activity_actor on public.activity_events(actor_email,at desc);
create table public.shift_calendars (trainee_id text primary key,source_url text,source_type text not null,timezone text not null default 'America/Detroit',last_sync text,error text,updated_by text not null,updated_at text not null);
create table public.scheduled_shifts (id text primary key,trainee_id text not null,event_uid text not null,title text not null,start_at text not null,end_at text not null,cancelled integer not null default 0,imported_at text not null);
create index scheduled_person on public.scheduled_shifts(trainee_id,start_at);
alter table public.reu_records enable row level security;
alter table public.reu_assets enable row level security;
alter table public.activity_events enable row level security;
alter table public.shift_calendars enable row level security;
alter table public.scheduled_shifts enable row level security;
revoke all on public.reu_records,public.reu_assets,public.activity_events,public.shift_calendars,public.scheduled_shifts from public,anon,authenticated;
grant select,insert,update,delete on public.reu_records,public.reu_assets,public.shift_calendars,public.scheduled_shifts to service_role;
grant select,insert on public.activity_events to service_role;
create function public.reu_record_put(k text,v jsonb,expected text default null,only_new boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.reu_records;
begin
 if current_user <> 'service_role' then raise exception 'Server only'; end if;
 if only_new then
  insert into public.reu_records(key,value) values(k,v) on conflict do nothing returning * into r;
 elsif expected is not null then
  update public.reu_records set value=v,version=gen_random_uuid(),updated_at=now() where key=k and version::text=expected returning * into r;
 else
  insert into public.reu_records(key,value) values(k,v) on conflict(key) do update set value=excluded.value,version=gen_random_uuid(),updated_at=now() returning * into r;
 end if;
 if r.key is null then return null;end if;
 return jsonb_build_object('etag',r.version);
end $$;
revoke all on function public.reu_record_put(text,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.reu_record_put(text,jsonb,text,boolean) to service_role;
-- Compatibility for the three fixed SQL stores. Callable only by the verified server.
create function public.reu_database_batch(operations jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare op jsonb; q text; parts text[]; i integer; val jsonb; results jsonb='[]'; rows jsonb; sqltext text;
begin
 if current_user <> 'service_role' then raise exception 'Server only';end if;
 for op in select * from jsonb_array_elements(operations) loop
  q=op->>'sql';
  if q !~* '^(SELECT \* FROM|INSERT INTO|UPDATE|DELETE FROM) (activity_events|shift_calendars|scheduled_shifts)( |\()' or q ~ ';' then raise exception 'Unsupported statement';end if;
  if q ~* '^(UPDATE|DELETE FROM) activity_events' then raise exception 'Activity is append only';end if;
  parts=string_to_array(q,'?');sqltext=parts[1];
  if array_length(parts,1)-1 <> jsonb_array_length(op->'values') then raise exception 'Parameter mismatch';end if;
  for i in 2..array_length(parts,1) loop
   val=(op->'values')->(i-2);
   sqltext=sqltext || case when val='null'::jsonb then 'NULL' else quote_literal(val#>>'{}') end || parts[i];
  end loop;
  -- Qualify the only permitted application tables.
  sqltext=regexp_replace(sqltext,'\m(activity_events|shift_calendars|scheduled_shifts)\M','public.\1','g');
  if q ~* '^SELECT' then
   execute 'select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from ('||sqltext||') r' into rows;
  else execute sqltext; rows='[]'::jsonb;end if;
  results=results||jsonb_build_array(jsonb_build_object('results',rows,'success',true));
 end loop;return results;
end $$;
revoke all on function public.reu_database_batch(jsonb) from public,anon,authenticated;
grant execute on function public.reu_database_batch(jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('reu-private','reu-private',false,15728640);
