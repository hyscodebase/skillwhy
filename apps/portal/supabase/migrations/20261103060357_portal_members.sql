-- Optional portal only. Apply to a dedicated Supabase project, never the CLI.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '개발자' check (char_length(display_name) between 1 and 80),
  email text not null,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'reviewed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create unique index one_pending_deletion_request on public.account_deletion_requests(user_id) where status = 'pending';
create table public.member_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  target_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('member_created', 'profile_updated', 'member_activated', 'member_suspended', 'deletion_requested', 'deletion_reviewed')),
  created_at timestamptz not null default now()
);
alter table public.member_profiles enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.member_audit_events enable row level security;
revoke all on public.member_profiles, public.account_deletion_requests, public.member_audit_events from public, anon, authenticated;
grant select on public.member_profiles, public.account_deletion_requests, public.member_audit_events to authenticated;
grant update (display_name) on public.member_profiles to authenticated;

-- Database lookups remain fresh even when a JWT still contains old claims.
create function private.has_portal_session() returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'true' and exists (
    select 1 from auth.sessions s where s.user_id = auth.uid()
      and s.id::text = auth.jwt()->>'session_id' and (s.not_after is null or s.not_after > now())
  );
$$;
create function private.is_active_member() returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_portal_session() and exists (
    select 1 from public.member_profiles p where p.id = auth.uid() and p.status = 'active'
  );
$$;
create function private.is_portal_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_member() and exists (
    select 1 from public.member_profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;
revoke all on function private.has_portal_session(), private.is_active_member(), private.is_portal_admin() from public, anon;
grant execute on function private.has_portal_session(), private.is_active_member(), private.is_portal_admin() to authenticated;

create policy member_profile_read on public.member_profiles for select to authenticated
  using (private.is_active_member() and (id = (select auth.uid()) or private.is_portal_admin()));
create policy member_profile_edit on public.member_profiles for update to authenticated
  using (private.is_active_member() and id = (select auth.uid()))
  with check (private.is_active_member() and id = (select auth.uid()));
create policy deletion_request_read on public.account_deletion_requests for select to authenticated
  using (private.has_portal_session() and (user_id = (select auth.uid()) or private.is_portal_admin()));
create policy member_audit_read on public.member_audit_events for select to authenticated
  using (private.is_portal_admin());

create function private.initialize_member() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.member_profiles(id, email, display_name)
    values (new.id, coalesce(new.email, ''), coalesce(nullif(left(trim(regexp_replace(coalesce(new.raw_user_meta_data->>'display_name', ''), '[[:cntrl:]]', '', 'g')), 80), ''), '개발자'));
  insert into public.member_audit_events(target_id, action) values (new.id, 'member_created');
  return new;
end;
$$;
revoke all on function private.initialize_member() from public, anon, authenticated;
create trigger initialize_portal_member after insert on auth.users for each row execute function private.initialize_member();

create function private.sync_member_email() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.member_profiles set email = coalesce(new.email, ''), updated_at = now() where id = new.id;
  return new;
end;
$$;
revoke all on function private.sync_member_email() from public, anon, authenticated;
create trigger sync_portal_member_email after update of email on auth.users for each row execute function private.sync_member_email();

create function private.audit_profile_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at = now();
  if old.display_name is distinct from new.display_name then
    insert into public.member_audit_events(actor_id, target_id, action) values (auth.uid(), new.id, 'profile_updated');
  end if;
  return new;
end;
$$;
revoke all on function private.audit_profile_change() from public, anon, authenticated;
create trigger audit_portal_profile_change before update on public.member_profiles for each row execute function private.audit_profile_change();

create function private.change_member_status(target_user uuid, desired_status text) returns void language plpgsql security definer set search_path = '' as $$
declare previous_status text;
begin
  perform pg_advisory_xact_lock(7465291);
  if not private.is_portal_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  if target_user = auth.uid() then raise exception 'SELF_STATUS_CHANGE_FORBIDDEN' using errcode = '22023'; end if;
  if desired_status is null or desired_status not in ('active', 'suspended') then raise exception 'INVALID_STATUS' using errcode = '22023'; end if;
  select status into previous_status from public.member_profiles where id = target_user for update;
  if not found then raise exception 'MEMBER_NOT_FOUND' using errcode = '22023'; end if;
  if previous_status = desired_status then return; end if;
  update public.member_profiles set status = desired_status, updated_at = now() where id = target_user;
  insert into public.member_audit_events(actor_id, target_id, action)
    values (auth.uid(), target_user, case desired_status when 'active' then 'member_activated' else 'member_suspended' end);
end;
$$;
create function private.request_account_deletion(request_reason text) returns uuid language plpgsql security definer set search_path = '' as $$
declare request_id uuid;
begin
  if not private.has_portal_session() then raise exception 'SESSION_REQUIRED' using errcode = '42501'; end if;
  if char_length(coalesce(request_reason, '')) > 500 then raise exception 'REASON_TOO_LONG' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select id into request_id from public.account_deletion_requests where user_id = auth.uid() and status = 'pending';
  if found then return request_id; end if;
  insert into public.account_deletion_requests(user_id, reason) values (auth.uid(), trim(coalesce(request_reason, ''))) returning id into request_id;
  insert into public.member_audit_events(actor_id, target_id, action) values (auth.uid(), auth.uid(), 'deletion_requested');
  return request_id;
end;
$$;
create function private.review_account_deletion(request_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare target_user uuid;
begin
  if not private.is_portal_admin() then raise exception 'ADMIN_REQUIRED' using errcode = '42501'; end if;
  update public.account_deletion_requests set status = 'reviewed', reviewed_at = now(), reviewed_by = auth.uid()
    where id = request_id and status = 'pending' returning user_id into target_user;
  if not found then raise exception 'REQUEST_NOT_FOUND_OR_REVIEWED' using errcode = '22023'; end if;
  insert into public.member_audit_events(actor_id, target_id, action) values (auth.uid(), target_user, 'deletion_reviewed');
end;
$$;
revoke all on function private.change_member_status(uuid,text), private.request_account_deletion(text), private.review_account_deletion(uuid) from public, anon;
grant execute on function private.change_member_status(uuid,text), private.request_account_deletion(text), private.review_account_deletion(uuid) to authenticated;

-- Exposed RPC wrappers have invoker rights, no elevated public entry point.
create function public.portal_set_member_status(target_user uuid, desired_status text) returns void language sql security invoker set search_path = '' as $$ select private.change_member_status(target_user, desired_status); $$;
create function public.portal_request_account_deletion(request_reason text default '') returns uuid language sql security invoker set search_path = '' as $$ select private.request_account_deletion(request_reason); $$;
create function public.portal_review_account_deletion(request_id uuid) returns void language sql security invoker set search_path = '' as $$ select private.review_account_deletion(request_id); $$;
revoke all on function public.portal_set_member_status(uuid,text), public.portal_request_account_deletion(text), public.portal_review_account_deletion(uuid) from public, anon;
grant execute on function public.portal_set_member_status(uuid,text), public.portal_request_account_deletion(text), public.portal_review_account_deletion(uuid) to authenticated;
commit;
