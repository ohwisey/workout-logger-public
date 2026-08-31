-- Align indexes with the client history query, enforce the UI's one-exercise-
-- per-day rule, and reject session logs that reference another workout day.

drop index if exists public.wl_workout_days_user_idx;
drop index if exists public.wl_custom_exercises_user_idx;

create index if not exists wl_set_logs_user_performed_id_idx
  on public.wl_set_logs (user_id, performed_at desc, id desc);

create unique index if not exists wl_day_exercises_day_key_idx
  on public.wl_day_exercises (day_id, exercise_key);

create or replace function public.wl_save_session(
  p_session_id uuid,
  p_day_id uuid,
  p_day_name text,
  p_performed_at timestamptz,
  p_workout_date date,
  p_logs jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(p_logs) is distinct from 'array' then
    raise exception 'Logs must be a JSON array';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_logs) as log(day_exercise_id uuid)
    left join public.wl_day_exercises exercise
      on exercise.id = log.day_exercise_id
      and exercise.user_id = v_user_id
      and exercise.day_id = p_day_id
    where log.day_exercise_id is not null
      and exercise.id is null
  ) then
    raise exception 'A logged exercise does not belong to this workout day';
  end if;

  insert into public.wl_sessions (
    id, user_id, day_id, day_name, performed_at, workout_date, completed_at
  ) values (
    p_session_id, v_user_id, p_day_id, p_day_name, p_performed_at, p_workout_date, p_performed_at
  );

  insert into public.wl_set_logs (
    id,
    user_id,
    session_id,
    day_exercise_id,
    exercise_key,
    exercise_name,
    performed_at,
    workout_date,
    set_number,
    reps,
    weight_kg,
    completed
  )
  select
    coalesce(log.id, gen_random_uuid()),
    v_user_id,
    p_session_id,
    log.day_exercise_id,
    log.exercise_key,
    log.exercise_name,
    p_performed_at,
    p_workout_date,
    log.set_number,
    log.reps,
    log.weight_kg,
    log.completed
  from jsonb_to_recordset(p_logs) as log(
    id uuid,
    day_exercise_id uuid,
    exercise_key text,
    exercise_name text,
    set_number integer,
    reps integer,
    weight_kg numeric,
    completed boolean
  );
end;
$$;

revoke all on function public.wl_save_session(uuid, uuid, text, timestamptz, date, jsonb)
  from public, anon, authenticated;
grant execute on function public.wl_save_session(uuid, uuid, text, timestamptz, date, jsonb)
  to authenticated;
