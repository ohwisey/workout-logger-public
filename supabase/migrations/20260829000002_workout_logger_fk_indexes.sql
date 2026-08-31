-- Cover every composite owner foreign key with an index in the same column
-- order. The single-column indexes below are replaced by these left-prefix
-- indexes, which support both ordinary lookups and foreign-key checks.

drop index if exists public.wl_day_exercises_day_idx;
drop index if exists public.wl_day_exercises_custom_idx;
drop index if exists public.wl_sessions_day_idx;
drop index if exists public.wl_set_logs_session_idx;

create index if not exists wl_day_exercises_day_owner_idx
  on public.wl_day_exercises (day_id, user_id, position);

create index if not exists wl_day_exercises_custom_owner_idx
  on public.wl_day_exercises (custom_exercise_id, user_id)
  where custom_exercise_id is not null;

create index if not exists wl_sessions_day_owner_idx
  on public.wl_sessions (day_id, user_id)
  where day_id is not null;

create index if not exists wl_set_logs_session_owner_idx
  on public.wl_set_logs (session_id, user_id);

create index if not exists wl_set_logs_day_exercise_owner_idx
  on public.wl_set_logs (day_exercise_id, user_id)
  where day_exercise_id is not null;
