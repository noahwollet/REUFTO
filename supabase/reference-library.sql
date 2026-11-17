alter table public.reu_assets add column storage_key text;
alter table public.reu_assets add column history jsonb not null default '[]'::jsonb;
create function public.reu_asset_put(k text,m text,byte_count bigint,hash text,storage_path text,expected_hash text,uploaded_by text) returns boolean language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
 if current_user<>'service_role' then raise exception 'Server only';end if;
 if expected_hash is null then
  insert into public.reu_assets(key,mime,bytes,sha256,storage_key)values(k,m,byte_count,hash,storage_path) on conflict do nothing;
 else
  update public.reu_assets set mime=m,bytes=byte_count,sha256=hash,storage_key=storage_path,history=history||jsonb_build_array(jsonb_build_object('sha256',reu_assets.sha256,'storage_key',reu_assets.storage_key,'replaced_at',now(),'replaced_by',uploaded_by)) where key=k and sha256=expected_hash;
 end if;
 get diagnostics affected=row_count;return affected=1;
end $$;
revoke all on function public.reu_asset_put(text,text,bigint,text,text,text,text) from public,anon,authenticated;
grant execute on function public.reu_asset_put(text,text,bigint,text,text,text,text) to service_role;
