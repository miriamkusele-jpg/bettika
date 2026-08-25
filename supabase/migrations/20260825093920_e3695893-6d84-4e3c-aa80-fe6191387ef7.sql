CREATE OR REPLACE FUNCTION public.cancel_bet(_bet_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.bets; r public.rounds;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO b FROM public.bets WHERE id = _bet_id AND user_id = auth.uid() FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'bet not found'; END IF;
  IF b.status <> 'active' THEN RAISE EXCEPTION 'bet already settled'; END IF;
  SELECT * INTO r FROM public.rounds WHERE id = b.round_id;
  IF now() >= r.running_at THEN RAISE EXCEPTION 'the round already started'; END IF;
  DELETE FROM public.bets WHERE id = b.id;
  PERFORM public.wallet_apply(auth.uid(), b.amount, 0, 'bet_cancelled', 'round:'||r.id);
END; $$;

REVOKE ALL ON FUNCTION public.cancel_bet(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cancel_bet(uuid) TO authenticated;