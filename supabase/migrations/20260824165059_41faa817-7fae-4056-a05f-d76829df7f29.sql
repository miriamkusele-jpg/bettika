create or replace function public.bootstrap_account(_username text, _phone text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.profiles(id, username, phone) values (auth.uid(), _username, _phone)
    on conflict (id) do nothing;
  insert into public.wallets(user_id, cash_balance, bonus_balance) values (auth.uid(), 500, 0)
    on conflict (user_id) do nothing;
  insert into public.user_roles(user_id, role) values (auth.uid(), 'user')
    on conflict do nothing;
end; $$;

revoke execute on function public.bootstrap_account(text, text) from anon, public;
grant execute on function public.bootstrap_account(text, text) to authenticated;

update public.wallets set cash_balance = 500, bonus_balance = 0;