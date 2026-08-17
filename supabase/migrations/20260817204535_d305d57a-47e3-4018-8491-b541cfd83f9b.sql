-- ROLES ------------------------------------------------------------------
create type public.app_role as enum ('admin','moderator','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  phone text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "roles read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- WALLET -----------------------------------------------------------------
create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cash_balance numeric(14,2) not null default 0 check (cash_balance >= 0),
  bonus_balance numeric(14,2) not null default 0 check (bonus_balance >= 0),
  updated_at timestamptz not null default now()
);
grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "own wallet read" on public.wallets for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null,
  cash_delta numeric(14,2) not null default 0,
  bonus_delta numeric(14,2) not null default 0,
  cash_after numeric(14,2) not null,
  bonus_after numeric(14,2) not null,
  reference text,
  created_at timestamptz not null default now()
);
grant select on public.wallet_ledger to authenticated;
grant all on public.wallet_ledger to service_role;
alter table public.wallet_ledger enable row level security;
create policy "own ledger read" on public.wallet_ledger for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- GAME -------------------------------------------------------------------
create table public.rounds (
  id bigserial primary key,
  crash_multiplier numeric(10,2) not null,
  waiting_at timestamptz not null default now(),
  running_at timestamptz not null,
  crashed_at timestamptz not null,
  ends_at timestamptz not null,
  settled boolean not null default false
);
grant select on public.rounds to authenticated, anon;
grant all on public.rounds to service_role;
alter table public.rounds enable row level security;
create policy "rounds public read" on public.rounds for select to authenticated, anon using (true);

create table public.bets (
  id uuid primary key default gen_random_uuid(),
  round_id bigint not null references public.rounds(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  username text not null,
  slot smallint not null default 1,
  amount numeric(14,2) not null check (amount > 0),
  auto_cashout numeric(10,2),
  cashout_multiplier numeric(10,2),
  payout numeric(14,2) not null default 0,
  status text not null default 'active',
  is_bot boolean not null default false,
  created_at timestamptz not null default now(),
  unique (round_id, user_id, slot)
);
create index bets_round_idx on public.bets(round_id);
grant select on public.bets to authenticated, anon;
grant all on public.bets to service_role;
alter table public.bets enable row level security;
create policy "bets public read" on public.bets for select to authenticated, anon using (true);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  username text not null,
  body text not null check (char_length(body) between 1 and 300),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert on public.chat_messages to authenticated;
grant select on public.chat_messages to anon;
grant all on public.chat_messages to service_role;
alter table public.chat_messages enable row level security;
create policy "chat read" on public.chat_messages for select to authenticated, anon using (true);
create policy "chat insert own" on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid());
create policy "chat moderate" on public.chat_messages for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- HELPERS ----------------------------------------------------------------
create or replace function public.wallet_apply(
  _user_id uuid, _cash numeric, _bonus numeric, _type text, _ref text
) returns void language plpgsql security definer set search_path = public as $$
declare c numeric; b numeric;
begin
  update public.wallets
     set cash_balance = cash_balance + _cash,
         bonus_balance = bonus_balance + _bonus,
         updated_at = now()
   where user_id = _user_id
  returning cash_balance, bonus_balance into c, b;
  if not found then raise exception 'wallet not found'; end if;
  insert into public.wallet_ledger(user_id, entry_type, cash_delta, bonus_delta, cash_after, bonus_after, reference)
  values (_user_id, _type, _cash, _bonus, c, b, _ref);
end; $$;

create or replace function public.bootstrap_account(_username text, _phone text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.profiles(id, username, phone) values (auth.uid(), _username, _phone)
    on conflict (id) do nothing;
  insert into public.wallets(user_id, cash_balance, bonus_balance) values (auth.uid(), 0, 0)
    on conflict (user_id) do nothing;
  insert into public.user_roles(user_id, role) values (auth.uid(), 'user')
    on conflict do nothing;
end; $$;

-- multiplier curve: m(t) = exp(0.09 * seconds)
create or replace function public.round_multiplier(_running_at timestamptz, _at timestamptz)
returns numeric language sql immutable set search_path = public as $$
  select round(exp(0.09 * greatest(0, extract(epoch from (_at - _running_at))))::numeric, 2)
$$;

create or replace function public.gen_crash() returns numeric
language plpgsql volatile set search_path = public as $$
declare u double precision; m numeric;
begin
  u := random();
  if u < 0.03 then return 1.00; end if;
  m := round(((0.97 / (1 - u)))::numeric, 2);
  return least(greatest(m, 1.01), 1000.00);
end; $$;

create or replace function public.settle_round(_round_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rounds; b public.bets; win numeric;
begin
  select * into r from public.rounds where id = _round_id for update;
  if r is null or r.settled then return; end if;
  for b in select * from public.bets where round_id = _round_id and status = 'active' loop
    if b.auto_cashout is not null and b.auto_cashout <= r.crash_multiplier then
      win := round(b.amount * b.auto_cashout, 2);
      update public.bets set status='won', cashout_multiplier=b.auto_cashout, payout=win where id=b.id;
      if b.user_id is not null then
        perform public.wallet_apply(b.user_id, win, 0, 'bet_win', 'round:'||_round_id);
      end if;
    else
      update public.bets set status='lost', payout=0 where id=b.id;
    end if;
  end loop;
  update public.rounds set settled = true where id = _round_id;
end; $$;

create or replace function public.spawn_bot_bets(_round_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare names text[] := array['Brian K','Wanjiku','Otieno254','MercyN','KipropJ','Njoroge','AminaS','DennisM','FaithW','Kevoo','ZainabA','MutisoP','Chebet','SammyG','Lucy_W','OmarH','Titus254','Nyambura','Baraka','JoyM'];
  i int; amt numeric; ac numeric;
begin
  for i in 1..(8 + floor(random()*10)::int) loop
    amt := (array[10,20,50,100,250,500,1000,2500])[1+floor(random()*8)::int];
    ac := case when random() < 0.75 then round((1.15 + random()*4.5)::numeric,2) else null end;
    insert into public.bets(round_id, username, slot, amount, auto_cashout, is_bot)
    values (_round_id, names[1+floor(random()*array_length(names,1))::int], 1, amt, ac, true);
  end loop;
end; $$;

create or replace function public.ensure_current_round()
returns public.rounds language plpgsql security definer set search_path = public as $$
declare r public.rounds; m numeric; dur numeric; nid bigint;
begin
  perform pg_advisory_xact_lock(918273645);
  select * into r from public.rounds order by id desc limit 1;
  if r.id is not null and now() >= r.crashed_at and not r.settled then
    perform public.settle_round(r.id);
    select * into r from public.rounds where id = r.id;
  end if;
  if r.id is null or now() >= r.ends_at then
    m := public.gen_crash();
    dur := ln(m::double precision) / 0.09;
    insert into public.rounds(crash_multiplier, waiting_at, running_at, crashed_at, ends_at)
    values (m, now(), now() + interval '7 seconds',
            now() + interval '7 seconds' + (dur || ' seconds')::interval,
            now() + interval '7 seconds' + (dur || ' seconds')::interval + interval '4 seconds')
    returning id into nid;
    perform public.spawn_bot_bets(nid);
    select * into r from public.rounds where id = nid;
  end if;
  return r;
end; $$;

create or replace function public.place_bet(_slot smallint, _amount numeric, _auto_cashout numeric)
returns public.bets language plpgsql security definer set search_path = public as $$
declare r public.rounds; w public.wallets; b public.bets; use_bonus numeric := 0; use_cash numeric := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if _amount is null or _amount < 10 then raise exception 'minimum bet is KES 10'; end if;
  if _slot not in (1,2) then raise exception 'invalid slot'; end if;
  select * into r from public.rounds order by id desc limit 1;
  if r.id is null or now() >= r.running_at then raise exception 'betting is closed for this round'; end if;
  if exists (select 1 from public.bets where round_id=r.id and user_id=auth.uid() and slot=_slot) then
    raise exception 'bet already placed';
  end if;
  select * into w from public.wallets where user_id = auth.uid() for update;
  if w.user_id is null then raise exception 'wallet not found'; end if;
  if w.cash_balance + w.bonus_balance < _amount then raise exception 'insufficient balance'; end if;
  use_cash := least(w.cash_balance, _amount);
  use_bonus := _amount - use_cash;
  perform public.wallet_apply(auth.uid(), -use_cash, -use_bonus, 'bet_stake', 'round:'||r.id);
  insert into public.bets(round_id, user_id, username, slot, amount, auto_cashout)
  values (r.id, auth.uid(), coalesce((select username from public.profiles where id=auth.uid()),'player'),
          _slot, _amount, _auto_cashout)
  returning * into b;
  return b;
end; $$;

create or replace function public.cash_out(_bet_id uuid)
returns public.bets language plpgsql security definer set search_path = public as $$
declare b public.bets; r public.rounds; m numeric; win numeric;
begin
  select * into b from public.bets where id = _bet_id and user_id = auth.uid() for update;
  if b.id is null then raise exception 'bet not found'; end if;
  if b.status <> 'active' then raise exception 'bet already settled'; end if;
  select * into r from public.rounds where id = b.round_id;
  if now() < r.running_at then raise exception 'round has not started'; end if;
  if now() >= r.crashed_at then raise exception 'too late, round crashed'; end if;
  m := public.round_multiplier(r.running_at, now());
  if m > r.crash_multiplier then raise exception 'too late, round crashed'; end if;
  win := round(b.amount * m, 2);
  update public.bets set status='won', cashout_multiplier=m, payout=win where id=b.id returning * into b;
  perform public.wallet_apply(auth.uid(), win, 0, 'bet_win', 'round:'||r.id);
  return b;
end; $$;

grant execute on function public.ensure_current_round() to authenticated, anon;
grant execute on function public.place_bet(smallint, numeric, numeric) to authenticated;
grant execute on function public.cash_out(uuid) to authenticated;
grant execute on function public.bootstrap_account(text, text) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.bets;
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.wallets;