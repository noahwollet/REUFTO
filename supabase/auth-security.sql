create table public.reu_auth_limits(email_hash text primary key,window_start timestamptz not null,attempts integer not null);
alter table public.reu_auth_limits enable row level security;
revoke all on public.reu_auth_limits from public,anon,authenticated;
grant select,insert,update on public.reu_auth_limits to service_role;
create function public.reu_auth_attempt(email_value text) returns boolean language plpgsql security invoker set search_path='' as $$
declare count_value integer;
begin
 if current_user<>'service_role' then raise exception 'Server only';end if;
 insert into public.reu_auth_limits values(md5(lower(email_value)),now(),1)
 on conflict(email_hash) do update set window_start=case when reu_auth_limits.window_start<now()-interval '15 minutes' then now() else reu_auth_limits.window_start end,attempts=case when reu_auth_limits.window_start<now()-interval '15 minutes' then 1 else reu_auth_limits.attempts+1 end returning attempts into count_value;
 return count_value<=20;
end $$;
revoke all on function public.reu_auth_attempt(text) from public,anon,authenticated;
grant execute on function public.reu_auth_attempt(text) to service_role;
grant usage on schema auth to service_role;
grant select on auth.sessions to service_role;
create function public.reu_session_live(session_id uuid,user_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if current_user<>'service_role' then raise exception 'Server only';end if;
 return exists(select 1 from auth.sessions s where s.id=reu_session_live.session_id and s.user_id=reu_session_live.user_id and (s.not_after is null or s.not_after>now()));
end $$;
revoke all on function public.reu_session_live(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reu_session_live(uuid,uuid) to service_role;
-- Explicit deny policies document that browsers must use the verified API.
create policy server_only on public.reu_records for all to anon,authenticated using(false) with check(false);
create policy server_only on public.reu_assets for all to anon,authenticated using(false) with check(false);
create policy server_only on public.activity_events for all to anon,authenticated using(false) with check(false);
create policy server_only on public.shift_calendars for all to anon,authenticated using(false) with check(false);
create policy server_only on public.scheduled_shifts for all to anon,authenticated using(false) with check(false);
create policy server_only on public.reu_auth_limits for all to anon,authenticated using(false) with check(false);
