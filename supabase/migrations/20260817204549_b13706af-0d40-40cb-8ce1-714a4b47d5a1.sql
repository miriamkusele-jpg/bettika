revoke execute on function public.wallet_apply(uuid, numeric, numeric, text, text) from public, anon, authenticated;
revoke execute on function public.settle_round(bigint) from public, anon, authenticated;
revoke execute on function public.spawn_bot_bets(bigint) from public, anon, authenticated;
revoke execute on function public.gen_crash() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from anon;
revoke execute on function public.bootstrap_account(text, text) from anon;