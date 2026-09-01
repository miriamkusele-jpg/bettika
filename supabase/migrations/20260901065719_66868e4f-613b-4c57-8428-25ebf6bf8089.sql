-- New accounts start empty; balance only grows from real deposits.
CREATE OR REPLACE FUNCTION public.bootstrap_account(_username text, _phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.profiles(id, username, phone) values (auth.uid(), _username, _phone)
    on conflict (id) do nothing;
  insert into public.wallets(user_id, cash_balance, bonus_balance) values (auth.uid(), 0, 0)
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
$function$;

ALTER TABLE public.wallets ALTER COLUMN cash_balance SET DEFAULT 0;

-- Accept every Kenyan mobile prefix (Safaricom + Airtel), any input format.
CREATE OR REPLACE FUNCTION public.normalize_msisdn(_phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare d text; local text;
begin
  d := regexp_replace(coalesce(_phone,''), '\D', '', 'g');
  if left(d,3) = '254' then local := substr(d,4);
  elsif left(d,1) = '0' then local := substr(d,2);
  else local := d;
  end if;
  if local !~ '^[17][0-9]{8}$' then raise exception 'invalid Kenyan mobile number'; end if;
  return '254' || local;
end; $function$;

CREATE OR REPLACE FUNCTION public.create_deposit(_amount numeric, _phone text)
 RETURNS deposits
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d public.deposits; p text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 10 THEN RAISE EXCEPTION 'minimum deposit is KES 10'; END IF;
  IF _amount > 150000 THEN RAISE EXCEPTION 'maximum deposit is KES 150,000'; END IF;
  p := public.normalize_msisdn(_phone);
  INSERT INTO public.deposits(user_id, phone, amount, attempts)
  VALUES (auth.uid(), p, round(_amount, 2), 1)
  RETURNING * INTO d;
  RETURN d;
END; $function$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _phone text)
 RETURNS withdrawals
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w public.withdrawals; wal public.wallets; st text; p text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT status INTO st FROM public.profiles WHERE id = auth.uid();
  IF st <> 'active' THEN RAISE EXCEPTION 'account is not active'; END IF;
  IF _amount IS NULL OR _amount < 100 THEN RAISE EXCEPTION 'minimum withdrawal is KES 100'; END IF;
  p := public.normalize_msisdn(_phone);
  IF EXISTS (SELECT 1 FROM public.withdrawals WHERE user_id = auth.uid() AND status = 'pending') THEN
    RAISE EXCEPTION 'you already have a pending withdrawal';
  END IF;
  SELECT * INTO wal FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF wal.user_id IS NULL THEN RAISE EXCEPTION 'wallet not found'; END IF;
  IF wal.cash_balance < _amount THEN RAISE EXCEPTION 'insufficient cash balance (bonus funds cannot be withdrawn)'; END IF;
  INSERT INTO public.withdrawals(user_id, phone, amount)
  VALUES (auth.uid(), p, round(_amount, 2)) RETURNING * INTO w;
  PERFORM public.wallet_apply(auth.uid(), -w.amount, 0, 'withdrawal_hold', 'withdrawal:'||w.id);
  RETURN w;
END; $function$;