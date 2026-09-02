CREATE TABLE public.crash_queue (
  slot smallint PRIMARY KEY CHECK (slot BETWEEN 1 AND 5),
  crash_multiplier numeric NOT NULL CHECK (crash_multiplier >= 1.00 AND crash_multiplier <= 1000.00),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.crash_queue TO service_role;

ALTER TABLE public.crash_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read crash queue" ON public.crash_queue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER crash_queue_touch BEFORE UPDATE ON public.crash_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- keep the queue topped up to 5 entries
CREATE OR REPLACE FUNCTION public.crash_queue_fill()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE i smallint;
BEGIN
  FOR i IN 1..5 LOOP
    INSERT INTO public.crash_queue(slot, crash_multiplier)
    VALUES (i, public.gen_crash())
    ON CONFLICT (slot) DO NOTHING;
  END LOOP;
END; $$;

-- pop the next fly-away point and shift the queue up
CREATE OR REPLACE FUNCTION public.crash_queue_pop()
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m numeric;
BEGIN
  PERFORM public.crash_queue_fill();
  SELECT crash_multiplier INTO m FROM public.crash_queue WHERE slot = 1;
  DELETE FROM public.crash_queue WHERE slot = 1;
  UPDATE public.crash_queue SET slot = slot - 1 WHERE slot > 1;
  PERFORM public.crash_queue_fill();
  RETURN coalesce(m, public.gen_crash());
END; $$;

CREATE OR REPLACE FUNCTION public.admin_crash_queue()
RETURNS TABLE(slot smallint, crash_multiplier numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  PERFORM public.crash_queue_fill();
  RETURN QUERY SELECT q.slot, q.crash_multiplier FROM public.crash_queue q ORDER BY q.slot;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_crash_queue(_slot smallint, _multiplier numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  IF _slot IS NULL OR _slot < 1 OR _slot > 5 THEN RAISE EXCEPTION 'invalid position'; END IF;
  IF _multiplier IS NULL OR _multiplier < 1.00 OR _multiplier > 1000.00 THEN
    RAISE EXCEPTION 'fly-away point must be between 1.00 and 1000.00';
  END IF;
  PERFORM public.crash_queue_fill();
  UPDATE public.crash_queue SET crash_multiplier = round(_multiplier, 2) WHERE slot = _slot;
END; $$;

-- use the queued fly-away point for each new round
CREATE OR REPLACE FUNCTION public.ensure_current_round()
RETURNS rounds LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare r public.rounds; m numeric; dur numeric; nid bigint;
begin
  perform pg_advisory_xact_lock(918273645);
  select * into r from public.rounds order by id desc limit 1;
  if r.id is not null and now() >= r.crashed_at and not r.settled then
    perform public.settle_round(r.id);
    select * into r from public.rounds where id = r.id;
  end if;
  if r.id is null or now() >= r.ends_at then
    m := public.crash_queue_pop();
    dur := ln(greatest(m, 1.01)::double precision) / 0.09;
    insert into public.rounds(crash_multiplier, waiting_at, running_at, crashed_at, ends_at)
    values (m, now(), now() + interval '7 seconds',
            now() + interval '7 seconds' + (dur || ' seconds')::interval,
            now() + interval '7 seconds' + (dur || ' seconds')::interval + interval '4 seconds')
    returning id into nid;
    perform public.spawn_bot_bets(nid);
    select * into r from public.rounds where id = nid;
  end if;
  if now() < r.crashed_at then r.crash_multiplier := null; end if;
  return r;
end; $$;

-- minimum deposit is now KES 100
CREATE OR REPLACE FUNCTION public.create_deposit(_amount numeric, _phone text)
RETURNS deposits LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d public.deposits; p text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 100 THEN RAISE EXCEPTION 'minimum deposit is KES 100'; END IF;
  IF _amount > 150000 THEN RAISE EXCEPTION 'maximum deposit is KES 150,000'; END IF;
  p := public.normalize_msisdn(_phone);
  INSERT INTO public.deposits(user_id, phone, amount, attempts)
  VALUES (auth.uid(), p, round(_amount, 2), 1)
  RETURNING * INTO d;
  RETURN d;
END; $$;

SELECT public.crash_queue_fill();