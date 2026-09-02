REVOKE ALL ON FUNCTION public.crash_queue_fill() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.crash_queue_pop() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.crash_queue_fill() TO service_role;
GRANT EXECUTE ON FUNCTION public.crash_queue_pop() TO service_role;