-- 1. Admin operator wallet
CREATE TABLE public.admin_wallets (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 5000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_wallets TO authenticated;
GRANT ALL ON public.admin_wallets TO service_role;

ALTER TABLE public.admin_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read own operator wallet"
ON public.admin_wallets FOR SELECT TO authenticated
USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER admin_wallets_touch
BEFORE UPDATE ON public.admin_wallets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Ensure / read the operator wallet
CREATE OR REPLACE FUNCTION public.ensure_admin_wallet()
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  INSERT INTO public.admin_wallets(user_id) VALUES (auth.uid())
    ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO b FROM public.admin_wallets WHERE user_id = auth.uid();
  RETURN b;
END; $$;

-- 3. Transfer from operator wallet to the admin's main playing wallet
CREATE OR REPLACE FUNCTION public.admin_wallet_transfer(_amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  PERFORM public.ensure_admin_wallet();
  SELECT balance INTO b FROM public.admin_wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF b < _amount THEN RAISE EXCEPTION 'insufficient operator balance'; END IF;
  UPDATE public.admin_wallets SET balance = balance - round(_amount, 2)
   WHERE user_id = auth.uid() RETURNING balance INTO b;
  PERFORM public.wallet_apply(auth.uid(), round(_amount, 2), 0, 'admin_wallet_transfer', 'operator_float');
  RETURN b;
END; $$;

-- 4. Hide the fly-away point from players
REVOKE SELECT (crash_multiplier) ON public.rounds FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_current_round()
RETURNS rounds LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  -- players never learn the fly-away point before the plane leaves
  if now() < r.crashed_at then r.crash_multiplier := null; end if;
  return r;
end; $$;

-- 5. Public history: only rounds that already flew away
CREATE OR REPLACE FUNCTION public.round_history(_limit integer DEFAULT 24)
RETURNS TABLE(id bigint, crash_multiplier numeric, crashed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.crash_multiplier, r.crashed_at
  FROM public.rounds r
  WHERE now() >= r.crashed_at
  ORDER BY r.id DESC
  LIMIT least(coalesce(_limit, 24), 60)
$$;

-- 6. Admin-only: upcoming fly-away point + recent rounds
CREATE OR REPLACE FUNCTION public.admin_next_crash()
RETURNS TABLE(id bigint, crash_multiplier numeric, running_at timestamptz, crashed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  RETURN QUERY
    SELECT r.id, r.crash_multiplier, r.running_at, r.crashed_at
    FROM public.rounds r ORDER BY r.id DESC LIMIT 1;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_recent_rounds(_limit integer DEFAULT 20)
RETURNS TABLE(id bigint, crash_multiplier numeric, settled boolean, running_at timestamptz, crashed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  RETURN QUERY
    SELECT r.id, r.crash_multiplier, r.settled, r.running_at, r.crashed_at
    FROM public.rounds r ORDER BY r.id DESC LIMIT least(coalesce(_limit, 20), 100);
END; $$;

REVOKE ALL ON FUNCTION public.ensure_admin_wallet() FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_wallet_transfer(numeric) FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_next_crash() FROM anon, public;
REVOKE ALL ON FUNCTION public.admin_recent_rounds(integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_admin_wallet() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_wallet_transfer(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_next_crash() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recent_rounds(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.round_history(integer) TO anon, authenticated;