CREATE TABLE public.deposit_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deposit_id uuid NOT NULL REFERENCES public.deposits(id) ON DELETE CASCADE,
  attempt integer NOT NULL,
  phone text NOT NULL,
  checkout_request_id text UNIQUE,
  merchant_request_id text,
  correlation_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX deposit_attempts_deposit_idx ON public.deposit_attempts(deposit_id);

GRANT SELECT ON public.deposit_attempts TO authenticated;
GRANT ALL ON public.deposit_attempts TO service_role;

ALTER TABLE public.deposit_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own deposit attempts"
ON public.deposit_attempts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.deposits d WHERE d.id = deposit_id AND d.user_id = auth.uid()));

CREATE POLICY "Admins view all deposit attempts"
ON public.deposit_attempts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS correlation_id text;

-- Record a new STK push attempt against an existing deposit intent.
CREATE OR REPLACE FUNCTION public.attach_deposit_refs(_deposit_id uuid, _checkout text, _merchant text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE d public.deposits;
BEGIN
  SELECT * INTO d FROM public.deposits WHERE id = _deposit_id FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'deposit not found'; END IF;

  UPDATE public.deposits
     SET checkout_request_id = _checkout,
         merchant_request_id = _merchant,
         updated_at = now()
   WHERE id = _deposit_id;

  INSERT INTO public.deposit_attempts(deposit_id, attempt, phone, checkout_request_id, merchant_request_id, correlation_id)
  VALUES (_deposit_id, GREATEST(d.attempts, 1), d.phone, _checkout, _merchant, d.correlation_id)
  ON CONFLICT (checkout_request_id) DO NOTHING;
END; $function$;

-- Reopen a failed/stale deposit for another prompt. Never touches a credited deposit.
CREATE OR REPLACE FUNCTION public.retry_deposit(_deposit_id uuid, _correlation text)
RETURNS public.deposits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE d public.deposits;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO d FROM public.deposits WHERE id = _deposit_id AND user_id = auth.uid() FOR UPDATE;
  IF d.id IS NULL THEN RAISE EXCEPTION 'deposit not found'; END IF;
  IF d.status = 'success' THEN RAISE EXCEPTION 'this deposit was already paid'; END IF;
  IF d.status = 'pending' AND d.created_at > now() - interval '90 seconds' THEN
    RAISE EXCEPTION 'an M-PESA prompt is still active — check your phone before retrying';
  END IF;
  IF d.attempts >= 5 THEN RAISE EXCEPTION 'too many attempts for this deposit — start a new one'; END IF;

  UPDATE public.deposits
     SET status = 'pending',
         result_desc = NULL,
         checkout_request_id = NULL,
         merchant_request_id = NULL,
         attempts = d.attempts + 1,
         correlation_id = _correlation,
         created_at = now(),
         updated_at = now()
   WHERE id = d.id
  RETURNING * INTO d;

  RETURN d;
END; $function$;

-- New deposits start at attempt 1 and carry a correlation reference.
CREATE OR REPLACE FUNCTION public.create_deposit(_amount numeric, _phone text)
RETURNS public.deposits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE d public.deposits;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 10 THEN RAISE EXCEPTION 'minimum deposit is KES 10'; END IF;
  IF _amount > 150000 THEN RAISE EXCEPTION 'maximum deposit is KES 150,000'; END IF;
  IF _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'invalid Safaricom number'; END IF;
  INSERT INTO public.deposits(user_id, phone, amount, attempts)
  VALUES (auth.uid(), _phone, round(_amount, 2), 1)
  RETURNING * INTO d;
  RETURN d;
END; $function$;

-- Match a callback to a deposit through the current ref OR any earlier attempt.
CREATE OR REPLACE FUNCTION public.credit_deposit(_checkout text, _receipt text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE d public.deposits; b numeric := 0; did uuid;
BEGIN
  SELECT id INTO did FROM public.deposits WHERE checkout_request_id = _checkout;
  IF did IS NULL THEN
    SELECT deposit_id INTO did FROM public.deposit_attempts WHERE checkout_request_id = _checkout;
  END IF;
  IF did IS NULL THEN RAISE EXCEPTION 'deposit not found'; END IF;

  SELECT * INTO d FROM public.deposits WHERE id = did FOR UPDATE;
  IF d.status = 'success' THEN RETURN; END IF;
  IF d.amount >= 500 THEN b := d.amount; END IF;

  UPDATE public.deposits
     SET status = 'success', mpesa_receipt = _receipt, bonus_amount = b,
         checkout_request_id = coalesce(checkout_request_id, _checkout),
         result_desc = 'Payment received', updated_at = now()
   WHERE id = d.id;

  PERFORM public.wallet_apply(d.user_id, d.amount, b, 'mpesa_deposit', coalesce(_receipt, d.id::text));
END; $function$;

-- A failure only marks the matching attempt as failed; never a credited deposit.
CREATE OR REPLACE FUNCTION public.fail_deposit(_checkout text, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE did uuid;
BEGIN
  UPDATE public.deposit_attempts SET error_message = _reason WHERE checkout_request_id = _checkout;

  SELECT id INTO did FROM public.deposits WHERE checkout_request_id = _checkout;
  IF did IS NULL THEN
    SELECT deposit_id INTO did FROM public.deposit_attempts WHERE checkout_request_id = _checkout;
  END IF;
  IF did IS NULL THEN RETURN; END IF;

  UPDATE public.deposits
     SET status = 'failed', result_desc = _reason, updated_at = now()
   WHERE id = did AND status = 'pending';
END; $function$;

REVOKE ALL ON FUNCTION public.attach_deposit_refs(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_deposit(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_deposit(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_deposit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_deposit(uuid, text) TO authenticated;