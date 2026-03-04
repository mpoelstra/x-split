create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key,
  display_name text not null,
  email text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id text primary key,
  name text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  id text primary key,
  group_id text not null references groups(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique(group_id, profile_id)
);

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references groups(id) on delete cascade,
  title text not null,
  friend_member_id text references group_members(id),
  friend_name text,
  invite_email text,
  created_at timestamptz not null default now()
);

alter table bills
  add column if not exists created_by uuid references profiles(id);

alter table bills
  alter column created_by set default auth.uid();

update public.bills b
set created_by = coalesce(
  b.created_by,
  (
    select g.created_by
    from public.groups g
    where g.id = b.group_id
  )
)
where b.created_by is null;

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references groups(id) on delete cascade,
  bill_id uuid references bills(id) on delete cascade,
  invite_email text not null,
  accepted_by_profile_id uuid references profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(group_id, invite_email, bill_id)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references groups(id) on delete cascade,
  bill_id uuid not null references bills(id) on delete cascade,
  created_by_profile_id uuid references profiles(id) on delete set null,
  game_title text not null,
  trueachievements_url text,
  amount numeric(10,2) not null check (amount > 0),
  currency text not null default 'EUR',
  paid_by_member_id text not null references group_members(id),
  net_to_payer numeric(10,2),
  expense_date date not null,
  category text,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

alter table expenses
  add column if not exists net_to_payer numeric(10,2);

alter table expenses
  add column if not exists created_by_profile_id uuid references profiles(id) on delete set null;

alter table expenses
  add column if not exists trueachievements_url text;

alter table expenses
  alter column created_by_profile_id set default auth.uid();

update public.expenses e
set created_by_profile_id = coalesce(
  e.created_by_profile_id,
  (
    select g.created_by
    from public.groups g
    where g.id = e.group_id
  ),
  (
    select gm.profile_id
    from public.group_members gm
    where gm.id = e.paid_by_member_id
  )
)
where e.created_by_profile_id is null;

create index if not exists idx_group_members_group on group_members(group_id);
create index if not exists idx_group_members_profile on group_members(profile_id);
create index if not exists idx_bills_group on bills(group_id, created_at desc);
create index if not exists idx_invites_group on invites(group_id, created_at desc);
create index if not exists idx_invites_email on invites(lower(invite_email));
create index if not exists idx_expenses_bill on expenses(bill_id, expense_date desc);
create index if not exists idx_expenses_group on expenses(group_id);
create index if not exists idx_expenses_created_by on expenses(created_by_profile_id);

alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table bills enable row level security;
alter table invites enable row level security;
alter table expenses enable row level security;

create or replace function public.is_group_member(target_group_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.profile_id = auth.uid()
  );
$$;

create or replace function public.shares_group_with_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm_self
    join public.group_members gm_target on gm_target.group_id = gm_self.group_id
    where gm_self.profile_id = auth.uid()
      and gm_target.profile_id = target_profile_id
  );
$$;

create or replace function public.is_group_owner(target_group_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = target_group_id
      and g.created_by = auth.uid()
  );
$$;

revoke all on function public.is_group_member(text) from public;
revoke all on function public.shares_group_with_profile(uuid) from public;
revoke all on function public.is_group_owner(text) from public;
grant execute on function public.is_group_member(text) to authenticated;
grant execute on function public.shares_group_with_profile(uuid) to authenticated;
grant execute on function public.is_group_owner(text) to authenticated;

drop policy if exists "users can view profiles in shared groups" on profiles;
drop policy if exists "users can insert profiles" on profiles;
drop policy if exists "members can view groups" on groups;
drop policy if exists "owners can insert groups" on groups;
drop policy if exists "members can view members" on group_members;
drop policy if exists "owners can insert group members" on group_members;
drop policy if exists "members can view bills" on bills;
drop policy if exists "members can insert bills" on bills;
drop policy if exists "creators can delete bills" on bills;
drop policy if exists "users can view invites" on invites;
drop policy if exists "members can insert invites" on invites;
drop policy if exists "members can view expenses" on expenses;
drop policy if exists "members can insert expenses" on expenses;
drop policy if exists "creators can delete expenses" on expenses;
drop policy if exists "creators can update expenses" on expenses;

create policy "users can view profiles in shared groups"
on profiles for select
using (
  public.shares_group_with_profile(profiles.id)
);

create policy "users can insert profiles"
on profiles for insert
with check (profiles.id = auth.uid());

create policy "members can view groups"
on groups for select
using (
  public.is_group_member(groups.id)
);

create policy "owners can insert groups"
on groups for insert
with check (
  groups.created_by = auth.uid()
);

create policy "members can view members"
on group_members for select
using (
  public.is_group_member(group_members.group_id)
);

create policy "owners can insert group members"
on group_members for insert
with check (
  public.is_group_owner(group_members.group_id)
);

create policy "members can view bills"
on bills for select
using (
  public.is_group_member(bills.group_id)
);

create policy "members can insert bills"
on bills for insert
with check (
  public.is_group_member(bills.group_id)
);

create policy "creators can delete bills"
on bills for delete
using (
  bills.created_by = auth.uid()
);

create policy "users can view invites"
on invites for select
using (
  public.is_group_member(invites.group_id)
  or lower(invites.invite_email) = lower(coalesce(auth.jwt()->>'email', ''))
);

create policy "members can insert invites"
on invites for insert
with check (
  public.is_group_member(invites.group_id)
);

create policy "members can view expenses"
on expenses for select
using (
  public.is_group_member(expenses.group_id)
);

create policy "members can insert expenses"
on expenses for insert
with check (
  public.is_group_member(expenses.group_id)
);

create policy "creators can delete expenses"
on expenses for delete
using (
  expenses.created_by_profile_id = auth.uid()
);

create policy "creators can update expenses"
on expenses for update
using (
  expenses.created_by_profile_id = auth.uid()
)
with check (
  expenses.created_by_profile_id = auth.uid()
);

create or replace function public.ensure_pending_member_for_bill(target_bill_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bill public.bills%rowtype;
  v_member_id text;
  v_pending_profile_id uuid;
  v_pending_email text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_bill
  from public.bills b
  where b.id = target_bill_id;

  if not found then
    raise exception 'Bill not found';
  end if;

  if not public.is_group_member(v_bill.group_id) then
    raise exception 'Not authorized for bill group';
  end if;

  if v_bill.friend_member_id is not null then
    return v_bill.friend_member_id;
  end if;

  if v_bill.invite_email is null then
    raise exception 'Bill has no invite email';
  end if;

  v_pending_profile_id := gen_random_uuid();
  v_pending_email := 'pending+' || substr(replace(v_pending_profile_id::text, '-', ''), 1, 12) || '@xsplit.local';
  v_member_id := 'member-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.profiles (id, display_name, email)
  values (
    v_pending_profile_id,
    coalesce(v_bill.friend_name, split_part(v_bill.invite_email, '@', 1)),
    v_pending_email
  );

  insert into public.group_members (id, group_id, profile_id, role)
  values (v_member_id, v_bill.group_id, v_pending_profile_id, 'member');

  update public.bills
  set friend_member_id = v_member_id,
      friend_name = coalesce(friend_name, split_part(v_bill.invite_email, '@', 1))
  where id = target_bill_id;

  return v_member_id;
end;
$$;

revoke all on function public.ensure_pending_member_for_bill(uuid) from public;
grant execute on function public.ensure_pending_member_for_bill(uuid) to authenticated;

create or replace function public.accept_pending_invites_for_current_user()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(
    coalesce(
      auth.jwt()->>'email',
      (
        select p.email
        from public.profiles p
        where p.id = auth.uid()
        limit 1
      ),
      ''
    )
  );
  inserted_count integer := 0;
begin
  if v_user_id is null or v_email = '' then
    return 0;
  end if;

  insert into public.group_members (id, group_id, profile_id, role)
  select
    'member-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    i.group_id,
    v_user_id,
    'member'
  from public.invites i
  where lower(i.invite_email) = v_email
    and not exists (
      select 1
      from public.group_members gm
      where gm.group_id = i.group_id
        and gm.profile_id = v_user_id
    )
  group by i.group_id;

  get diagnostics inserted_count = row_count;

  update public.invites i
  set accepted_by_profile_id = v_user_id,
      accepted_at = now()
  where lower(i.invite_email) = v_email
    and i.accepted_at is null;

  update public.expenses e
  set paid_by_member_id = gm_real.id
  from public.bills b
  join public.group_members gm_real
    on gm_real.group_id = b.group_id
   and gm_real.profile_id = v_user_id
  where e.bill_id = b.id
    and lower(coalesce(b.invite_email, '')) = v_email
    and e.paid_by_member_id = b.friend_member_id
    and b.friend_member_id is not null
    and b.friend_member_id <> gm_real.id;

  update public.bills b
  set friend_member_id = gm.id,
      friend_name = coalesce(b.friend_name, p.display_name)
  from public.group_members gm
  join public.profiles p on p.id = gm.profile_id
  where gm.group_id = b.group_id
    and gm.profile_id = v_user_id
    and lower(coalesce(b.invite_email, '')) = v_email;

  delete from public.group_members gm
  where gm.profile_id in (
    select p.id
    from public.profiles p
    where p.email like 'pending+%@xsplit.local'
  )
    and gm.group_id in (
      select distinct b.group_id
      from public.bills b
      where lower(coalesce(b.invite_email, '')) = v_email
    )
    and not exists (
      select 1
      from public.expenses e
      where e.paid_by_member_id = gm.id
    );

  delete from public.profiles p
  where p.email like 'pending+%@xsplit.local'
    and not exists (
      select 1
      from public.group_members gm
      where gm.profile_id = p.id
    );

  return inserted_count;
end;
$$;

revoke all on function public.accept_pending_invites_for_current_user() from public;
grant execute on function public.accept_pending_invites_for_current_user() to authenticated;

create or replace function public.admin_reset_app_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if v_user_id is null or v_email <> 'm.poelstra@gmail.com' then
    raise exception 'Not authorized';
  end if;

  delete from public.expenses where true;
  delete from public.bills where true;
  delete from public.invites where true;
  delete from public.group_members where true;
  delete from public.groups where true;
  delete from public.profiles where id <> v_user_id;
end;
$$;

revoke all on function public.admin_reset_app_data() from public;
grant execute on function public.admin_reset_app_data() to authenticated;
