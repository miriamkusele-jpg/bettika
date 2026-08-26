-- 1) Remove admin from anyone who is not the designated operator number
delete from public.user_roles ur
where ur.role = 'admin'
  and not exists (
    select 1 from public.profiles p
    where p.id = ur.user_id and p.phone = '+254722867910'
  );

-- 2) Grant admin to the designated operator number if that account exists
insert into public.user_roles(user_id, role)
select p.id, 'admin'::app_role from public.profiles p
where p.phone = '+254722867910'
on conflict do nothing;

insert into public.admin_wallets(user_id, balance)
select p.id, 5000 from public.profiles p
where p.phone = '+254722867910'
on conflict (user_id) do nothing;

-- 3) Enforce it: admin role can only ever belong to the operator phone
create or replace function public.enforce_single_admin_phone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'admin' then
    if not exists (
      select 1 from public.profiles p
      where p.id = new.user_id and p.phone = '+254722867910'
    ) then
      raise exception 'admin role is reserved for the operator account';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists user_roles_single_admin on public.user_roles;
create trigger user_roles_single_admin
before insert or update on public.user_roles
for each row execute function public.enforce_single_admin_phone();

-- 4) Account bootstrap grants admin + operator wallet only to that number
create or replace function public.bootstrap_account(_username text, _phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.profiles(id, username, phone) values (auth.uid(), _username, _phone)
    on conflict (id) do nothing;
  insert into public.wallets(user_id, cash_balance, bonus_balance) values (auth.uid(), 500, 0)
    on conflict (user_id) do nothing;
  insert into public.user_roles(user_id, role) values (auth.uid(), 'user')
    on conflict do nothing;

  if _phone = '+254722867910' then
    insert into public.user_roles(user_id, role) values (auth.uid(), 'admin')
      on conflict do nothing;
    insert into public.admin_wallets(user_id, balance) values (auth.uid(), 5000)
      on conflict (user_id) do nothing;
  end if;
end;
$$;

revoke execute on function public.bootstrap_account(text, text) from anon, public;
grant execute on function public.bootstrap_account(text, text) to authenticated;