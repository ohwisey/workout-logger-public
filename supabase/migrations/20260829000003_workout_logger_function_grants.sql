-- Trigger functions do not need to be directly callable by API roles.
revoke all on function public.wl_set_updated_at() from public, anon, authenticated;
