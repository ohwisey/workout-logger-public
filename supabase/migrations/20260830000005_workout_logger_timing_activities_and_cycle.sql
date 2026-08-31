-- Session timing, rest timers, non-lifting activities, and the Push / Pull /
-- Legs / REST cycle.
--
-- This database is shared with unrelated applications, so every statement here
-- is additive and re-runnable: new columns are nullable or defaulted, new
-- objects are guarded with "if not exists" / "or replace", and nothing that
-- already exists is dropped, renamed, retyped, or loosened.
--
-- Design notes:
--   * A rest day is a normal row in wl_workout_days with kind = 'rest'. Rest is
--     a real slot in the rotation, so it must sit in the same ordered list as
--     the training days, share the position/drag ordering, and be able to hold
--     a sauna or tanning entry.
--   * Cardio / sauna / tanning are PLANNED in wl_day_exercises (kind =
--     'activity') so the plan stays one drag-ordered list, but are LOGGED in a
--     new wl_activity_logs table. They have a duration and no sets, and folding
--     them into wl_set_logs would mean fake set_number/reps/weight rows that
--     would silently distort the existing per-exercise history and graph.
--   * wl_sessions gains timing columns rather than a parallel session table.
--
-- RUN THIS INSIDE A SINGLE TRANSACTION. Nothing here needs to run outside one
-- (there is no CREATE INDEX CONCURRENTLY), and a mid-script failure must not
-- leave the new columns present while wl_replace_workout_day still has its old
-- body. The Supabase SQL editor wraps a multi-statement run for you; if you
-- apply this any other way, wrap it in begin; ... commit; yourself.

-- The two new tables reference auth.users, which takes a ShareRowExclusiveLock
-- on it. auth.users is SHARED with the other apps in this project, so that lock
-- blocks their sign-ins, sign-ups and token refreshes while it is held.
-- Validation is instantaneous because both new tables are empty, but without a
-- timeout a conflicting lock elsewhere would make this wait forever and queue
-- every auth write behind it, turning a momentary DDL into an auth outage.
-- Fail fast instead.
set lock_timeout = '5s';
set statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 1. New optional columns on existing tables
-- ---------------------------------------------------------------------------

-- 'rest' days are real days in the cycle; they simply carry no lifting rows.
alter table public.wl_workout_days
  add column if not exists kind text not null default 'workout'
    check (kind in ('workout', 'rest'));

-- kind = 'activity' rows are cardio / sauna / tanning entries. The specific
-- type stays in exercise_key ('cardio', 'sauna', 'tanning-bed', ...) so a new
-- activity type never needs another migration. rest_seconds is the per-exercise
-- rest-timer override; null means "use wl_user_settings.default_rest_seconds".
alter table public.wl_day_exercises
  add column if not exists kind text not null default 'lift'
    check (kind in ('lift', 'activity')),
  add column if not exists target_duration_seconds integer
    check (target_duration_seconds is null
           or (target_duration_seconds >= 0 and target_duration_seconds <= 86400)),
  add column if not exists rest_seconds integer
    check (rest_seconds is null or (rest_seconds >= 0 and rest_seconds <= 3600));

-- started_at is written when "Start workout" is tapped; completed_at already
-- existed and remains the end of the session. duration_seconds is filled by the
-- trigger below when it is not supplied, so an untimed session stays valid.
-- cycle_position records which slot of the rotation this session was, at the
-- time it happened, so later drag-reordering cannot rewrite history.
alter table public.wl_sessions
  add column if not exists kind text not null default 'workout'
    check (kind in ('workout', 'activity', 'rest')),
  add column if not exists started_at timestamptz,
  add column if not exists duration_seconds integer
    check (duration_seconds is null
           or (duration_seconds >= 0 and duration_seconds <= 86400)),
  add column if not exists cycle_position integer
    check (cycle_position is null or cycle_position >= 0);

-- How long the athlete actually rested before this set.
alter table public.wl_set_logs
  add column if not exists rest_taken_seconds integer
    check (rest_taken_seconds is null
           or (rest_taken_seconds >= 0 and rest_taken_seconds <= 3600));

-- ---------------------------------------------------------------------------
-- 2. Per-user settings: rest-timer default and cycle pointer
-- ---------------------------------------------------------------------------

-- current_day_id points at a day row rather than a position, so dragging days
-- into a new order moves the pointer with the day instead of silently changing
-- which day is "next".
create table if not exists public.wl_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_rest_seconds integer not null default 90
    check (default_rest_seconds >= 0 and default_rest_seconds <= 3600),
  rest_timer_enabled boolean not null default true,
  current_day_id uuid,
  cycle_started_on date,
  cycle_advanced_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wl_user_settings_current_day_owner_fk
    foreign key (current_day_id, user_id)
    references public.wl_workout_days(id, user_id)
    on delete set null (current_day_id)
);

-- ---------------------------------------------------------------------------
-- 3. Non-lifting activity logs (duration, no sets)
-- ---------------------------------------------------------------------------

create table if not exists public.wl_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  day_exercise_id uuid,
  activity_key text not null check (char_length(activity_key) between 1 and 160),
  activity_name text not null check (char_length(activity_name) between 1 and 120),
  entry_number integer not null default 1 check (entry_number between 1 and 100),
  performed_at timestamptz not null default now(),
  workout_date date not null default current_date,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0
    check (duration_seconds >= 0 and duration_seconds <= 86400),
  completed boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (session_id, activity_key, entry_number),
  constraint wl_activity_logs_session_owner_fk
    foreign key (session_id, user_id)
    references public.wl_sessions(id, user_id)
    on delete cascade,
  constraint wl_activity_logs_day_exercise_owner_fk
    foreign key (day_exercise_id, user_id)
    references public.wl_day_exercises(id, user_id)
    on delete set null (day_exercise_id)
);

-- ---------------------------------------------------------------------------
-- 4. Indexes (composite owner foreign keys are covered in the same column
--    order as migration 20260829000002)
-- ---------------------------------------------------------------------------

create index if not exists wl_user_settings_current_day_owner_idx
  on public.wl_user_settings (current_day_id, user_id)
  where current_day_id is not null;

create index if not exists wl_activity_logs_history_idx
  on public.wl_activity_logs (user_id, activity_key, workout_date desc, performed_at desc);

create index if not exists wl_activity_logs_user_performed_id_idx
  on public.wl_activity_logs (user_id, performed_at desc, id desc);

create index if not exists wl_activity_logs_session_owner_idx
  on public.wl_activity_logs (session_id, user_id);

create index if not exists wl_activity_logs_day_exercise_owner_idx
  on public.wl_activity_logs (day_exercise_id, user_id)
  where day_exercise_id is not null;

-- ---------------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------------

create or replace trigger wl_user_settings_updated_at
before update on public.wl_user_settings
for each row execute function public.wl_set_updated_at();

-- Derive session duration from the timestamps whenever the client did not send
-- one. Every duration is then clamped to the range the check constraint allows,
-- whether it was derived here or supplied by the client, so a workout left
-- running overnight still saves instead of losing the whole session to a
-- constraint violation.
create or replace function public.wl_sessions_apply_duration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Clamp BEFORE the ::integer cast. A mistyped started_at (an 1800s date, a
  -- stray epoch-0) yields more than 2^31 seconds, and casting first would raise
  -- "integer out of range" and abort the whole save.
  if new.duration_seconds is null
     and new.started_at is not null
     and new.completed_at is not null then
    new.duration_seconds := least(
      86400,
      greatest(0, floor(extract(epoch from (new.completed_at - new.started_at))))
    )::integer;
  end if;

  -- Guarded by the null test: least/greatest ignore nulls in Postgres, so an
  -- unguarded clamp would turn "no duration recorded" into 0. Already an
  -- integer here, so there is nothing to overflow.
  if new.duration_seconds is not null then
    new.duration_seconds := least(86400, greatest(0, new.duration_seconds));
  end if;

  return new;
end;
$$;

revoke all on function public.wl_sessions_apply_duration() from public, anon, authenticated;

create or replace trigger wl_sessions_apply_duration
before insert or update on public.wl_sessions
for each row execute function public.wl_sessions_apply_duration();

-- ---------------------------------------------------------------------------
-- 6. Row level security for the new tables
-- ---------------------------------------------------------------------------

alter table public.wl_user_settings enable row level security;
alter table public.wl_activity_logs enable row level security;

revoke all on public.wl_user_settings from anon;
revoke all on public.wl_activity_logs from anon;
revoke all on public.wl_user_settings from authenticated;
revoke all on public.wl_activity_logs from authenticated;

grant select, insert, update, delete on public.wl_user_settings to authenticated;
grant select, insert, update, delete on public.wl_activity_logs to authenticated;

drop policy if exists "wl_user_settings_select_own" on public.wl_user_settings;
drop policy if exists "wl_user_settings_insert_own" on public.wl_user_settings;
drop policy if exists "wl_user_settings_update_own" on public.wl_user_settings;
drop policy if exists "wl_user_settings_delete_own" on public.wl_user_settings;

create policy "wl_user_settings_select_own" on public.wl_user_settings
for select to authenticated using ((select auth.uid()) = user_id);
create policy "wl_user_settings_insert_own" on public.wl_user_settings
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "wl_user_settings_update_own" on public.wl_user_settings
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "wl_user_settings_delete_own" on public.wl_user_settings
for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "wl_activity_logs_select_own" on public.wl_activity_logs;
drop policy if exists "wl_activity_logs_insert_own" on public.wl_activity_logs;
drop policy if exists "wl_activity_logs_update_own" on public.wl_activity_logs;
drop policy if exists "wl_activity_logs_delete_own" on public.wl_activity_logs;

create policy "wl_activity_logs_select_own" on public.wl_activity_logs
for select to authenticated using ((select auth.uid()) = user_id);
create policy "wl_activity_logs_insert_own" on public.wl_activity_logs
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "wl_activity_logs_update_own" on public.wl_activity_logs
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "wl_activity_logs_delete_own" on public.wl_activity_logs
for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 7. Planning: same signature, now round-trips the new per-entry fields
-- ---------------------------------------------------------------------------

-- The argument list is unchanged, so the currently deployed client keeps
-- working: keys it does not send arrive as null and fall back to the previous
-- defaults. Once the client sends kind / target_duration_seconds /
-- rest_seconds, a cardio or sauna entry survives a plan re-save.
create or replace function public.wl_replace_workout_day(
  p_day_id uuid,
  p_name text,
  p_position integer,
  p_exercises jsonb
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
  if jsonb_typeof(p_exercises) is distinct from 'array' then
    raise exception 'Exercises must be a JSON array';
  end if;

  update public.wl_workout_days
  set name = p_name, position = p_position
  where id = p_day_id and user_id = v_user_id;

  if not found then
    raise exception 'Workout day not found';
  end if;

  delete from public.wl_day_exercises
  where day_id = p_day_id and user_id = v_user_id;

  insert into public.wl_day_exercises (
    id,
    user_id,
    day_id,
    custom_exercise_id,
    exercise_key,
    exercise_name,
    position,
    target_sets,
    target_reps,
    target_weight_kg,
    kind,
    target_duration_seconds,
    rest_seconds
  )
  select
    coalesce(exercise.id, gen_random_uuid()),
    v_user_id,
    p_day_id,
    exercise.custom_exercise_id,
    exercise.exercise_key,
    exercise.exercise_name,
    exercise.position,
    coalesce(exercise.target_sets, 3),
    coalesce(exercise.target_reps, 10),
    coalesce(exercise.target_weight_kg, 0),
    coalesce(exercise.kind, 'lift'),
    exercise.target_duration_seconds,
    exercise.rest_seconds
  from jsonb_to_recordset(p_exercises) as exercise(
    id uuid,
    custom_exercise_id uuid,
    exercise_key text,
    exercise_name text,
    position integer,
    target_sets integer,
    target_reps integer,
    target_weight_kg numeric,
    kind text,
    target_duration_seconds integer,
    rest_seconds integer
  );
end;
$$;

revoke all on function public.wl_replace_workout_day(uuid, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.wl_replace_workout_day(uuid, text, integer, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Drag reordering
-- ---------------------------------------------------------------------------

-- wl_workout_days carries a non-deferrable unique (user_id, position), so a
-- naive reorder collides mid-statement. The whole list is parked above the
-- current maximum first, then renumbered 0..n-1, inside one transaction.
-- The full ordered list is required: a partial list would leave the omitted
-- days sitting on positions the renumbering is about to claim.
create or replace function public.wl_reorder_workout_days(p_day_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_supplied integer;
  v_distinct integer;
  v_owned integer;
  v_total integer;
  v_offset integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_supplied := coalesce(array_length(p_day_ids, 1), 0);
  if v_supplied = 0 then
    raise exception 'At least one workout day is required';
  end if;
  if array_position(p_day_ids, null::uuid) is not null then
    raise exception 'Workout day list contains a null id';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  select count(distinct supplied.day_id)
    into v_distinct
    from pg_catalog.unnest(p_day_ids) as supplied(day_id);

  if v_distinct <> v_supplied then
    raise exception 'Workout day list contains a duplicate id';
  end if;

  -- security definer bypasses row level security, so ownership is checked
  -- explicitly here and every statement below is scoped to user_id.
  select count(*)
    into v_owned
    from public.wl_workout_days d
    where d.user_id = v_user_id
      and d.id = any(p_day_ids);

  if v_owned <> v_supplied then
    raise exception 'Workout day not found';
  end if;

  select count(*)
    into v_total
    from public.wl_workout_days d
    where d.user_id = v_user_id;

  if v_total <> v_supplied then
    raise exception 'Reordering requires every workout day, in order';
  end if;

  select coalesce(max(d.position), 0) + 1
    into v_offset
    from public.wl_workout_days d
    where d.user_id = v_user_id;

  update public.wl_workout_days
  set position = position + v_offset
  where user_id = v_user_id;

  update public.wl_workout_days d
  set position = (ordered.ordinality - 1)::integer
  from pg_catalog.unnest(p_day_ids) with ordinality as ordered(day_id, ordinality)
  where d.id = ordered.day_id
    and d.user_id = v_user_id;
end;
$$;

revoke all on function public.wl_reorder_workout_days(uuid[])
  from public, anon, authenticated;
grant execute on function public.wl_reorder_workout_days(uuid[])
  to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Cycle counting
-- ---------------------------------------------------------------------------

-- Move the pointer to the next day in the rotation, wrapping back to the first
-- day and restamping cycle_started_on when the cycle completes. Calling twice
-- on the same date is a no-op, so a double tap cannot skip a day. The client
-- passes its own local date because the server clock is UTC.
create or replace function public.wl_advance_cycle_day(p_workout_date date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_current_day_id uuid;
  v_current_position integer;
  v_advanced_on date;
  v_started_on date;
  v_next_day_id uuid;
  v_wrapped boolean := false;
  v_date date := coalesce(p_workout_date, current_date);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  insert into public.wl_user_settings (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select s.current_day_id, s.cycle_advanced_on, s.cycle_started_on
    into v_current_day_id, v_advanced_on, v_started_on
    from public.wl_user_settings s
    where s.user_id = v_user_id
    for update;

  if v_current_day_id is not null and v_advanced_on = v_date then
    return v_current_day_id;
  end if;

  if v_current_day_id is null then
    v_wrapped := true;
  else
    select d.position
      into v_current_position
      from public.wl_workout_days d
      where d.id = v_current_day_id and d.user_id = v_user_id;

    select d.id
      into v_next_day_id
      from public.wl_workout_days d
      where d.user_id = v_user_id
        and d.position > v_current_position
      order by d.position
      limit 1;
  end if;

  if v_next_day_id is null then
    v_wrapped := true;

    select d.id
      into v_next_day_id
      from public.wl_workout_days d
      where d.user_id = v_user_id
      order by d.position
      limit 1;
  end if;

  if v_next_day_id is null then
    raise exception 'No workout days to advance through';
  end if;

  update public.wl_user_settings
  set current_day_id = v_next_day_id,
      cycle_advanced_on = v_date,
      cycle_started_on = case
        when v_wrapped or v_started_on is null then v_date
        else v_started_on
      end
  where user_id = v_user_id;

  return v_next_day_id;
end;
$$;

revoke all on function public.wl_advance_cycle_day(date)
  from public, anon, authenticated;
grant execute on function public.wl_advance_cycle_day(date)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Saving a timed session with sets and activities
-- ---------------------------------------------------------------------------

-- Supersedes wl_save_session, which is left in place unchanged so the deployed
-- client keeps working during the rollout. A separate name is used rather than
-- an overload because PostgREST resolves overloaded functions by request body
-- keys. Sets and activities are written with the session in one transaction, so
-- history can never hold a partial workout.
create or replace function public.wl_save_session_v2(
  p_session_id uuid,
  p_day_id uuid,
  p_day_name text,
  p_kind text,
  p_cycle_position integer,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_performed_at timestamptz,
  p_workout_date date,
  p_duration_seconds integer,
  p_logs jsonb,
  p_activities jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_logs jsonb := coalesce(p_logs, '[]'::jsonb);
  v_activities jsonb := coalesce(p_activities, '[]'::jsonb);
  v_performed_at timestamptz := coalesce(p_performed_at, now());
  v_workout_date date := coalesce(p_workout_date, current_date);
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(v_logs) is distinct from 'array' then
    raise exception 'Logs must be a JSON array';
  end if;
  if jsonb_typeof(v_activities) is distinct from 'array' then
    raise exception 'Activities must be a JSON array';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_logs) as log(day_exercise_id uuid)
    left join public.wl_day_exercises exercise
      on exercise.id = log.day_exercise_id
      and exercise.user_id = v_user_id
      and exercise.day_id = p_day_id
    where log.day_exercise_id is not null
      and exercise.id is null
  ) then
    raise exception 'A logged exercise does not belong to this workout day';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_activities) as activity(day_exercise_id uuid)
    left join public.wl_day_exercises exercise
      on exercise.id = activity.day_exercise_id
      and exercise.user_id = v_user_id
      and exercise.day_id = p_day_id
    where activity.day_exercise_id is not null
      and exercise.id is null
  ) then
    raise exception 'A logged activity does not belong to this workout day';
  end if;

  insert into public.wl_sessions (
    id,
    user_id,
    day_id,
    day_name,
    kind,
    cycle_position,
    started_at,
    performed_at,
    workout_date,
    completed_at,
    duration_seconds
  ) values (
    p_session_id,
    v_user_id,
    p_day_id,
    p_day_name,
    coalesce(p_kind, 'workout'),
    p_cycle_position,
    p_started_at,
    v_performed_at,
    v_workout_date,
    coalesce(p_completed_at, v_performed_at),
    p_duration_seconds
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
    completed,
    rest_taken_seconds
  )
  select
    coalesce(log.id, gen_random_uuid()),
    v_user_id,
    p_session_id,
    log.day_exercise_id,
    log.exercise_key,
    log.exercise_name,
    coalesce(log.performed_at, v_performed_at),
    v_workout_date,
    log.set_number,
    log.reps,
    log.weight_kg,
    coalesce(log.completed, false),
    -- A long gap between sets (phone pocketed, a genuine break) must not fail
    -- the whole workout on the 0..3600 check. Clamp, keeping null as null:
    -- least/greatest ignore nulls, so an unguarded clamp would record a
    -- never-timed rest as 0 seconds.
    case
      when log.rest_taken_seconds is null then null
      else least(3600, greatest(0, log.rest_taken_seconds))
    end
  from jsonb_to_recordset(v_logs) as log(
    id uuid,
    day_exercise_id uuid,
    exercise_key text,
    exercise_name text,
    performed_at timestamptz,
    set_number integer,
    reps integer,
    weight_kg numeric,
    completed boolean,
    rest_taken_seconds integer
  );

  insert into public.wl_activity_logs (
    id,
    user_id,
    session_id,
    day_exercise_id,
    activity_key,
    activity_name,
    entry_number,
    performed_at,
    workout_date,
    started_at,
    ended_at,
    duration_seconds,
    completed,
    notes
  )
  select
    coalesce(activity.id, gen_random_uuid()),
    v_user_id,
    p_session_id,
    activity.day_exercise_id,
    activity.activity_key,
    activity.activity_name,
    coalesce(activity.entry_number, 1),
    coalesce(activity.performed_at, v_performed_at),
    v_workout_date,
    activity.started_at,
    activity.ended_at,
    -- The ::integer cast sits OUTSIDE the clamp for the same reason as the
    -- session trigger: a nonsense timestamp pair produces a value larger than
    -- an integer, and casting before clamping would abort the session save.
    least(
      86400,
      greatest(
        0,
        coalesce(
          activity.duration_seconds,
          floor(extract(epoch from (activity.ended_at - activity.started_at))),
          0
        )
      )
    )::integer,
    coalesce(activity.completed, true),
    activity.notes
  from jsonb_to_recordset(v_activities) as activity(
    id uuid,
    day_exercise_id uuid,
    activity_key text,
    activity_name text,
    entry_number integer,
    performed_at timestamptz,
    started_at timestamptz,
    ended_at timestamptz,
    duration_seconds integer,
    completed boolean,
    notes text
  );
end;
$$;

revoke all on function public.wl_save_session_v2(
  uuid, uuid, text, text, integer, timestamptz, timestamptz, timestamptz, date, integer, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.wl_save_session_v2(
  uuid, uuid, text, text, integer, timestamptz, timestamptz, timestamptz, date, integer, jsonb, jsonb
) to authenticated;
