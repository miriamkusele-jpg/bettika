-- DEPOSITS
CREATE TABLE public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  amount numeric NOT NULL,
  bonus_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  checkout_request_id text,
  merchant_request_id text,
  mpesa_receipt text,
  result_desc text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deposits_checkout_idx ON public.deposits(checkout_request_id);
CREATE INDEX deposits_user_idx ON public.deposits(user_id, created_at DESC);

GRANT SELECT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own deposits read" ON public.deposits FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- WITHDRAWALS
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX withdrawals_user_idx ON public.withdrawals(user_id, created_at DESC);

GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own withdrawals read" ON public.withdrawals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Create a pending deposit for the signed-in user (called from server fn before STK push)
CREATE OR REPLACE FUNCTION public.create_deposit(_amount numeric, _phone text)
RETURNS public.deposits
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE d public.deposits;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 10 THEN RAISE EXCEPTION 'minimum deposit is KES 10'; END IF;
  IF _amount > 150000 THEN RAISE EXCEPTION 'maximum deposit is KES 150,000'; END IF;
  IF _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'invalid Safaricom number'; END IF;
  INSERT INTO public.deposits(user_id, phone, amount) VALUES (auth.uid(), _phone, round(_amount, 2))
  RETURNING * INTO d;
  RETURN d;
END; $$;

-- Attach M-PESA references to a pending deposit (service role only)
CREATE OR REPLACE FUNCTION public.attach_deposit_refs(_deposit_id uuid, _checkout text, _merchant text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.deposits
     SET checkout_request_id = _checkout, merchant_request_id = _merchant, updated_at = now()
   WHERE id = _deposit_id;
$$;

-- Credit a confirmed deposit (idempotent). 100% bonus on KES 500+
CREATE OR REPLACE FUNCTION public.credit_deposit(_checkout text, _receipt text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE d public.deposits; b numeric := 0;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE checkout_request_id = _checkout FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'deposit not found'; END IF;
  IF d.status = 'success' THEN RETURN; END IF;
  IF d.amount >= 500 THEN b := d.amount; END IF;
  UPDATE public.deposits
     SET status = 'success', mpesa_receipt = _receipt, bonus_amount = b,
         result_desc = 'Payment received', updated_at = now()
   WHERE id = d.id;
  PERFORM public.wallet_apply(d.user_id, d.amount, b, 'mpesa_deposit', coalesce(_receipt, d.id::text));
END; $$;

CREATE OR REPLACE FUNCTION public.fail_deposit(_checkout text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.deposits
     SET status = 'failed', result_desc = _reason, updated_at = now()
   WHERE checkout_request_id = _checkout AND status = 'pending';
END; $$;

-- Player requests a withdrawal; cash is held immediately
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _phone text)
RETURNS public.withdrawals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE w public.withdrawals; wal public.wallets; st text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT status INTO st FROM public.profiles WHERE id = auth.uid();
  IF st <> 'active' THEN RAISE EXCEPTION 'account is not active'; END IF;
  IF _amount IS NULL OR _amount < 100 THEN RAISE EXCEPTION 'minimum withdrawal is KES 100'; END IF;
  IF _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'invalid Safaricom number'; END IF;
  IF EXISTS (SELECT 1 FROM public.withdrawals WHERE user_id = auth.uid() AND status = 'pending') THEN
    RAISE EXCEPTION 'you already have a pending withdrawal';
  END IF;
  SELECT * INTO wal FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF wal.user_id IS NULL THEN RAISE EXCEPTION 'wallet not found'; END IF;
  IF wal.cash_balance < _amount THEN RAISE EXCEPTION 'insufficient cash balance (bonus funds cannot be withdrawn)'; END IF;
  INSERT INTO public.withdrawals(user_id, phone, amount)
  VALUES (auth.uid(), _phone, round(_amount, 2)) RETURNING * INTO w;
  PERFORM public.wallet_apply(auth.uid(), -w.amount, 0, 'withdrawal_hold', 'withdrawal:'||w.id);
  RETURN w;
END; $$;

-- Admin reviews a withdrawal
CREATE OR REPLACE FUNCTION public.admin_review_withdrawal(_id uuid, _approve boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE w public.withdrawals;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  SELECT * INTO w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'withdrawal not found'; END IF;
  IF w.status <> 'pending' THEN RAISE EXCEPTION 'already reviewed'; END IF;
  IF _approve THEN
    UPDATE public.withdrawals SET status='paid', admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=w.id;
    PERFORM public.wallet_apply(w.user_id, 0, 0, 'withdrawal_paid', 'withdrawal:'||w.id);
  ELSE
    UPDATE public.withdrawals SET status='rejected', admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now() WHERE id=w.id;
    PERFORM public.wallet_apply(w.user_id, w.amount, 0, 'withdrawal_refund', 'withdrawal:'||w.id);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(_user_id uuid, _cash numeric, _bonus numeric, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  PERFORM public.wallet_apply(_user_id, coalesce(_cash,0), coalesce(_bonus,0), 'admin_adjustment', coalesce(_note,'manual'));
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  IF _status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'invalid status'; END IF;
  UPDATE public.profiles SET status = _status WHERE id = _user_id;
END; $$;

-- Lock down internal-only functions
REVOKE ALL ON FUNCTION public.credit_deposit(text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_deposit(text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.attach_deposit_refs(uuid, text, text) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_deposit(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_withdrawal(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) TO authenticated;