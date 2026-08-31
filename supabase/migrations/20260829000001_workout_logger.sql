-- Standalone workout logger schema. All objects are namespaced with wl_ so the
-- existing Vitality schema remains untouched.

create or replace function public.wl_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.wl_workout_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, position)
);

create table public.wl_custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  muscle_group text not null default 'other' check (char_length(muscle_group) between 1 and 50),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index wl_custom_exercises_user_name_idx
  on public.wl_custom_exercises (user_id, lower(name));

create table public.wl_day_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_id uuid not null,
  custom_exercise_id uuid,
  exercise_key text not null check (char_length(exercise_key) between 1 and 160),
  exercise_name text not null check (char_length(exercise_name) between 1 and 120),
  position integer not null check (position >= 0),
  target_sets integer not null default 3 check (target_sets between 1 and 30),
  target_reps integer not null default 10 check (target_reps between 0 and 500),
  target_weight_kg numeric(8,2) not null default 0 check (target_weight_kg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (day_id, position),
  constraint wl_day_exercises_day_owner_fk
    foreign key (day_id, user_id)
    references public.wl_workout_days(id, user_id)
    on delete cascade,
  constraint wl_day_exercises_custom_owner_fk
    foreign key (custom_exercise_id, user_id)
    references public.wl_custom_exercises(id, user_id)
    on delete set null (custom_exercise_id)
);

create table public.wl_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_id uuid,
  day_name text not null check (char_length(day_name) between 1 and 80),
  performed_at timestamptz not null default now(),
  workout_date date not null default current_date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint wl_sessions_day_owner_fk
    foreign key (day_id, user_id)
    references public.wl_workout_days(id, user_id)
    on delete set null (day_id)
);

create table public.wl_set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  day_exercise_id uuid,
  exercise_key text not null check (char_length(exercise_key) between 1 and 160),
  exercise_name text not null check (char_length(exercise_name) between 1 and 120),
  performed_at timestamptz not null default now(),
  workout_date date not null default current_date,
  set_number integer not null check (set_number between 1 and 100),
  reps integer not null check (reps between 0 and 500),
  weight_kg numeric(8,2) not null default 0 check (weight_kg >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (session_id, exercise_key, set_number),
  constraint wl_set_logs_session_owner_fk
    foreign key (session_id, user_id)
    references public.wl_sessions(id, user_id)
    on delete cascade,
  constraint wl_set_logs_day_exercise_owner_fk
    foreign key (day_exercise_id, user_id)
    references public.wl_day_exercises(id, user_id)
    on delete set null (day_exercise_id)
);

create index wl_workout_days_user_idx on public.wl_workout_days (user_id, position);
create index wl_custom_exercises_user_idx on public.wl_custom_exercises (user_id);
create index wl_day_exercises_user_idx on public.wl_day_exercises (user_id);
create index wl_day_exercises_day_idx on public.wl_day_exercises (day_id, position);
create index wl_day_exercises_custom_idx on public.wl_day_exercises (custom_exercise_id) where custom_exercise_id is not null;
create index wl_sessions_user_time_idx on public.wl_sessions (user_id, performed_at desc);
create index wl_sessions_day_idx on public.wl_sessions (day_id) where day_id is not null;
create index wl_set_logs_history_idx on public.wl_set_logs (user_id, exercise_key, workout_date desc, performed_at desc);
create index wl_set_logs_session_idx on public.wl_set_logs (session_id);

create trigger wl_workout_days_updated_at
before update on public.wl_workout_days
for each row execute function public.wl_set_updated_at();

create trigger wl_custom_exercises_updated_at
before update on public.wl_custom_exercises
for each row execute function public.wl_set_updated_at();

create trigger wl_day_exercises_updated_at
before update on public.wl_day_exercises
for each row execute function public.wl_set_updated_at();

create trigger wl_sessions_updated_at
before update on public.wl_sessions
for each row execute function public.wl_set_updated_at();

alter table public.wl_workout_days enable row level security;
alter table public.wl_custom_exercises enable row level security;
alter table public.wl_day_exercises enable row level security;
alter table public.wl_sessions enable row level security;
alter table public.wl_set_logs enable row level security;

revoke all on public.wl_workout_days from anon;
revoke all on public.wl_custom_exercises from anon;
revoke all on public.wl_day_exercises from anon;
revoke all on public.wl_sessions from anon;
revoke all on public.wl_set_logs from anon;

revoke all on public.wl_workout_days from authenticated;
revoke all on public.wl_custom_exercises from authenticated;
revoke all on public.wl_day_exercises from authenticated;
revoke all on public.wl_sessions from authenticated;
revoke all on public.wl_set_logs from authenticated;

grant select, insert, update, delete on public.wl_workout_days to authenticated;
grant select, insert, update, delete on public.wl_custom_exercises to authenticated;
grant select, insert, update, delete on public.wl_day_exercises to authenticated;
grant select, insert, update, delete on public.wl_sessions to authenticated;
grant select, insert, update, delete on public.wl_set_logs to authenticated;

create policy "wl_workout_days_select_own" on public.wl_workout_days
for select to authenticated using ((select auth.uid()) = user_id);
create policy "wl_workout_days_insert_own" on public.wl_workout_days
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "wl_workout_days_update_own" on public.wl_workout_days
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "wl_workout_days_delete_own" on public.wl_workout_days
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "wl_custom_exercises_select_own" on public.wl_custom_exercises
for select to authenticated using ((select auth.uid()) = user_id);
create policy "wl_custom_exercises_insert_own" on public.wl_custom_exercises
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "wl_custom_exercises_update_own" on public.wl_custom_exercises
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "wl_custom_exercises_delete_own" on public.wl_custom_exercises
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "wl_day_exercises_select_own" on public.wl_day_exercises
for select to authenticated using ((select auth.uid()) = user_id);
create policy "wl_day_exercises_insert_own" on public.wl_day_exercises
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "wl_day_exercises_update_own" on public.wl_day_exercises
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "wl_day_exercises_delete_own" on public.wl_day_exercises
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "wl_sessions_select_own" on public.wl_sessions
for select to authenticated using ((select auth.uid()) = user_id);
create policy "wl_sessions_insert_own" on public.wl_sessions
for insert to authenticated with check (
  (select auth.uid()) = user_id
  and (
    day_id is null
    or exists (
      select 1 from public.wl_workout_days d
      where d.id = day_id and d.user_id = (select auth.uid())
    )
  )
);
create policy "wl_sessions_update_own" on public.wl_sessions
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "wl_sessions_delete_own" on public.wl_sessions
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "wl_set_logs_select_own" on public.wl_set_logs
for select to authenticated using ((select auth.uid()) = user_id);
create policy "wl_set_logs_insert_own" on public.wl_set_logs
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "wl_set_logs_update_own" on public.wl_set_logs
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "wl_set_logs_delete_own" on public.wl_set_logs
for delete to authenticated using ((select auth.uid()) = user_id);

-- Replace a workout day in one transaction. If any exercise is invalid, the
-- old plan remains untouched instead of being left empty or half-written.
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
    target_weight_kg
  )
  select
    coalesce(exercise.id, gen_random_uuid()),
    v_user_id,
    p_day_id,
    exercise.custom_exercise_id,
    exercise.exercise_key,
    exercise.exercise_name,
    exercise.position,
    exercise.target_sets,
    exercise.target_reps,
    exercise.target_weight_kg
  from jsonb_to_recordset(p_exercises) as exercise(
    id uuid,
    custom_exercise_id uuid,
    exercise_key text,
    exercise_name text,
    position integer,
    target_sets integer,
    target_reps integer,
    target_weight_kg numeric
  );
end;
$$;

-- Save the session row and every set together. A failed set insert rolls the
-- whole workout back, so history can never contain a partial session.
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

-- Seed a new account once. The per-user advisory lock prevents two first-load
-- requests from racing and creating duplicate default days.
create or replace function public.wl_seed_default_days(p_days jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_day jsonb;
  v_day_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(p_days) is distinct from 'array' then
    raise exception 'Days must be a JSON array';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  if exists (
    select 1 from public.wl_workout_days where user_id = v_user_id
  ) then
    return;
  end if;

  for v_day in select value from jsonb_array_elements(p_days)
  loop
    v_day_id := coalesce((v_day ->> 'id')::uuid, gen_random_uuid());

    insert into public.wl_workout_days (id, user_id, name, position)
    values (
      v_day_id,
      v_user_id,
      v_day ->> 'name',
      (v_day ->> 'position')::integer
    );

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
      target_weight_kg
    )
    select
      coalesce(exercise.id, gen_random_uuid()),
      v_user_id,
      v_day_id,
      exercise.custom_exercise_id,
      exercise.exercise_key,
      exercise.exercise_name,
      exercise.position,
      exercise.target_sets,
      exercise.target_reps,
      exercise.target_weight_kg
    from jsonb_to_recordset(coalesce(v_day -> 'exercises', '[]'::jsonb)) as exercise(
      id uuid,
      custom_exercise_id uuid,
      exercise_key text,
      exercise_name text,
      position integer,
      target_sets integer,
      target_reps integer,
      target_weight_kg numeric
    );
  end loop;
end;
$$;

revoke all on function public.wl_replace_workout_day(uuid, text, integer, jsonb) from public, anon;
revoke all on function public.wl_save_session(uuid, uuid, text, timestamptz, date, jsonb) from public, anon;
revoke all on function public.wl_seed_default_days(jsonb) from public, anon;

grant execute on function public.wl_replace_workout_day(uuid, text, integer, jsonb) to authenticated;
grant execute on function public.wl_save_session(uuid, uuid, text, timestamptz, date, jsonb) to authenticated;
grant execute on function public.wl_seed_default_days(jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workout-exercise-images',
  'workout-exercise-images',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "wl_exercise_images_select_own" on storage.objects
for select to authenticated using (
  bucket_id = 'workout-exercise-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "wl_exercise_images_insert_own" on storage.objects
for insert to authenticated with check (
  bucket_id = 'workout-exercise-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "wl_exercise_images_update_own" on storage.objects
for update to authenticated using (
  bucket_id = 'workout-exercise-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
) with check (
  bucket_id = 'workout-exercise-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "wl_exercise_images_delete_own" on storage.objects
for delete to authenticated using (
  bucket_id = 'workout-exercise-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
