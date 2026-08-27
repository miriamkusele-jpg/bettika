ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'upesipay';
ALTER TABLE public.deposit_attempts ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'upesipay';

UPDATE public.deposits SET provider = 'daraja' WHERE created_at < now();
UPDATE public.deposit_attempts SET provider = 'daraja' WHERE created_at < now();

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

  INSERT INTO public.deposit_attempts(deposit_id, attempt, phone, checkout_request_id, merchant_request_id, correlation_id, provider)
  VALUES (_deposit_id, GREATEST(d.attempts, 1), d.phone, _checkout, _merchant, d.correlation_id, d.provider)
  ON CONFLICT (checkout_request_id) DO NOTHING;
END; $function$;

CREATE OR REPLACE FUNCTION public.set_deposit_provider(_deposit_id uuid, _provider text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _provider NOT IN ('upesipay','daraja') THEN RAISE EXCEPTION 'unknown provider'; END IF;
  UPDATE public.deposits SET provider = _provider, updated_at = now() WHERE id = _deposit_id;
END; $function$;

REVOKE ALL ON FUNCTION public.set_deposit_provider(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_deposit_provider(uuid, text) TO service_role;