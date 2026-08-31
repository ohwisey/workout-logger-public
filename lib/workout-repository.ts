import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_EXERCISE_KEYS, findBuiltInExercise } from './library'
import { getSupabaseBrowserClient } from './supabase/client'
import { uid } from './uid'
import type {
  AppSnapshot,
  AuthState,
  ExerciseOption,
  NewCustomExercise,
  SessionDraftExercise,
  SetLog,
  WorkoutDay,
} from './types'

const LOCAL_STORAGE_KEY = 'workout-logger:v1'
const HISTORY_PAGE_SIZE = 1000
const SIGNED_IMAGE_SECONDS = 60 * 60 * 24 * 7

interface CloudSetLogRow {
  id: string
  user_id: string
  session_id: string
  day_exercise_id: string | null
  exercise_key: string
  exercise_name: string
  performed_at: string
  workout_date: string
  set_number: number
  reps: number
  weight_kg: number | string
  completed: boolean
}

function id(): string {
  return uid()
}

function defaultDays(): WorkoutDay[] {
  return Object.entries(DEFAULT_EXERCISE_KEYS).map(([name, keys], dayPosition) => {
    const dayId = id()
    return {
      id: dayId,
      name,
      position: dayPosition,
      exercises: keys.map((key, position) => {
        const exercise = findBuiltInExercise(key)!
        return {
          ...exercise,
          id: id(),
          dayId,
          position,
          targetSets: key === 'bench_bb' || key === 'back_squat' ? 4 : 3,
          targetReps: key === 'bench_bb' || key === 'back_squat' ? 5 : 10,
          targetWeightKg: key === 'bench_bb' ? 80 : 0,
        }
      }),
    }
  })
}

function freshSnapshot(): AppSnapshot {
  return { days: defaultDays(), customExercises: [], logs: [] }
}

function localSnapshot(): AppSnapshot {
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
  if (!raw) {
    const snapshot = freshSnapshot()
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot))
    return snapshot
  }
  try {
    const snapshot = JSON.parse(raw) as AppSnapshot
    return {
      ...snapshot,
      logs: (snapshot.logs ?? []).map((log) => ({
        ...log,
        workoutDate: log.workoutDate ?? log.performedAt.slice(0, 10),
      })),
    }
  } catch {
    const snapshot = freshSnapshot()
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot))
    return snapshot
  }
}

function saveLocal(snapshot: AppSnapshot): AppSnapshot {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(snapshot))
  return snapshot
}

function localDate(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function requireClient(): SupabaseClient {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase is not configured.')
  return client
}

async function fetchAllSetLogs(client: SupabaseClient): Promise<CloudSetLogRow[]> {
  const rows: CloudSetLogRow[] = []
  let cursor: Pick<CloudSetLogRow, 'performed_at' | 'id'> | null = null

  for (;;) {
    let query = client
      .from('wl_set_logs')
      .select('*')
      .order('performed_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(HISTORY_PAGE_SIZE)

    if (cursor) {
      query = query.or(
        `performed_at.lt.${cursor.performed_at},and(performed_at.eq.${cursor.performed_at},id.lt.${cursor.id})`,
      )
    }

    const { data, error } = await query
    if (error) throw error
    const page = (data ?? []) as CloudSetLogRow[]
    rows.push(...page)
    if (page.length < HISTORY_PAGE_SIZE) return rows
    cursor = page.at(-1)!
  }
}

export async function loadSnapshot(auth: AuthState): Promise<AppSnapshot> {
  if (auth.mode === 'local' || !auth.userId) return localSnapshot()

  const client = requireClient()
  const [daysResult, exercisesResult, customResult, logRows] = await Promise.all([
    client.from('wl_workout_days').select('*').order('position'),
    client.from('wl_day_exercises').select('*').order('position'),
    client.from('wl_custom_exercises').select('*').order('name'),
    fetchAllSetLogs(client),
  ])

  const error = daysResult.error ?? exercisesResult.error ?? customResult.error
  if (error) throw error

  if (!daysResult.data?.length) {
    await seedCloudDays(client)
    return loadSnapshot(auth)
  }

  const customRows = customResult.data ?? []
  const paths = customRows.map((row) => row.image_path).filter(Boolean) as string[]
  const signedByPath = new Map<string, string>()
  if (paths.length) {
    const { data } = await client.storage.from('workout-exercise-images').createSignedUrls(paths, SIGNED_IMAGE_SECONDS)
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl)
    }
  }

  const customExercises: ExerciseOption[] = customRows.map((row) => ({
    key: `custom:${row.id}`,
    name: row.name,
    muscleGroup: row.muscle_group,
    imageUrl: row.image_path ? signedByPath.get(row.image_path) ?? null : null,
    customExerciseId: row.id,
  }))

  const days: WorkoutDay[] = (daysResult.data ?? []).map((day) => ({
    id: day.id,
    name: day.name,
    position: day.position,
    exercises: (exercisesResult.data ?? [])
      .filter((exercise) => exercise.day_id === day.id)
      .map((exercise) => {
        const builtIn = findBuiltInExercise(exercise.exercise_key)
        const custom = customExercises.find((option) => option.customExerciseId === exercise.custom_exercise_id)
        return {
          id: exercise.id,
          dayId: exercise.day_id,
          key: exercise.exercise_key,
          name: exercise.exercise_name,
          muscleGroup: custom?.muscleGroup ?? builtIn?.muscleGroup ?? 'other',
          imageUrl: custom?.imageUrl ?? builtIn?.imageUrl ?? null,
          // Library-derived fields must be re-attached on every load: they are
          // deliberately not stored in the database (only the key is), and
          // without them the balance line and the form popup are silently dead
          // on every saved cloud day while working fine in local dev.
          imageUrlEnd: builtIn?.imageUrlEnd ?? null,
          tip: builtIn?.tip,
          perHand: builtIn?.perHand ?? false,
          region: builtIn?.region,
          pattern: builtIn?.pattern,
          customExerciseId: exercise.custom_exercise_id,
          position: exercise.position,
          targetSets: exercise.target_sets,
          targetReps: exercise.target_reps,
          targetWeightKg: Number(exercise.target_weight_kg),
        }
      }),
  }))

  const logs: SetLog[] = logRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    dayExerciseId: row.day_exercise_id,
    exerciseKey: row.exercise_key,
    exerciseName: row.exercise_name,
    performedAt: row.performed_at,
    workoutDate: row.workout_date,
    setNumber: row.set_number,
    reps: row.reps,
    weightKg: Number(row.weight_kg),
    completed: row.completed,
  }))

  return { days, customExercises, logs }
}

async function seedCloudDays(client: SupabaseClient): Promise<void> {
  const seed = defaultDays()
  const { error } = await client.rpc('wl_seed_default_days', {
    p_days: seed.map((day) => ({
      id: day.id,
      name: day.name,
      position: day.position,
      exercises: day.exercises.map((exercise) => ({
        id: exercise.id,
        custom_exercise_id: exercise.customExerciseId ?? null,
        exercise_key: exercise.key,
        exercise_name: exercise.name,
        position: exercise.position,
        target_sets: exercise.targetSets,
        target_reps: exercise.targetReps,
        target_weight_kg: exercise.targetWeightKg,
      })),
    })),
  })
  if (error) throw error
}

export async function saveWorkoutDay(
  auth: AuthState,
  currentSnapshot: AppSnapshot,
  day: WorkoutDay,
): Promise<AppSnapshot> {
  if (auth.mode === 'local' || !auth.userId) {
    return saveLocal({
      ...currentSnapshot,
      days: currentSnapshot.days.map((candidate) => (candidate.id === day.id ? day : candidate)),
    })
  }

  const client = requireClient()
  const { error } = await client.rpc('wl_replace_workout_day', {
    p_day_id: day.id,
    p_name: day.name,
    p_position: day.position,
    p_exercises: day.exercises.map((exercise, position) => ({
      id: exercise.id,
      custom_exercise_id: exercise.customExerciseId ?? null,
      exercise_key: exercise.key,
      exercise_name: exercise.name,
      position,
      target_sets: exercise.targetSets,
      target_reps: exercise.targetReps,
      target_weight_kg: exercise.targetWeightKg,
    })),
  })
  if (error) throw error
  return loadSnapshot(auth)
}

export async function addWorkoutDay(
  auth: AuthState,
  currentSnapshot: AppSnapshot,
  name: string,
): Promise<AppSnapshot> {
  const position = currentSnapshot.days.length
  if (auth.mode === 'local' || !auth.userId) {
    const day: WorkoutDay = { id: id(), name, position, exercises: [] }
    return saveLocal({ ...currentSnapshot, days: [...currentSnapshot.days, day] })
  }
  const client = requireClient()
  const { error } = await client.from('wl_workout_days').insert({ user_id: auth.userId, name, position })
  if (error) throw error
  return loadSnapshot(auth)
}

async function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

interface PreparedImage {
  blob: Blob
  extension: string
  contentType: string
}

async function prepareImage(file: File): Promise<PreparedImage> {
  try {
    const bitmap = await createImageBitmap(file)
    const maxSide = 1000
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare this photo.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((output) => (output ? resolve(output) : reject(new Error('Could not compress this photo.'))), 'image/webp', 0.78)
    })
    return { blob, extension: 'webp', contentType: 'image/webp' }
  } catch {
    const extensionByType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heif',
    }
    const extension = extensionByType[file.type]
    if (!extension || file.size > 15 * 1024 * 1024) {
      throw new Error('Use a JPG, PNG, WebP, HEIC, or HEIF photo under 15 MB.')
    }
    return { blob: file, extension, contentType: file.type }
  }
}

export async function createCustomExercise(
  auth: AuthState,
  currentSnapshot: AppSnapshot,
  input: NewCustomExercise,
): Promise<AppSnapshot> {
  if (auth.mode === 'local' || !auth.userId) {
    const customId = id()
    const prepared = input.image ? await prepareImage(input.image) : null
    const option: ExerciseOption = {
      key: `custom:${customId}`,
      customExerciseId: customId,
      name: input.name.trim(),
      muscleGroup: input.muscleGroup.trim() || 'other',
      imageUrl: prepared ? await fileToDataUrl(prepared.blob) : null,
    }
    return saveLocal({
      ...currentSnapshot,
      customExercises: [...currentSnapshot.customExercises, option],
    })
  }

  const client = requireClient()
  const customId = id()
  let imagePath: string | null = null
  if (input.image) {
    const prepared = await prepareImage(input.image)
    imagePath = `${auth.userId}/${customId}.${prepared.extension}`
    const { error: uploadError } = await client.storage
      .from('workout-exercise-images')
      .upload(imagePath, prepared.blob, { contentType: prepared.contentType, upsert: false })
    if (uploadError) throw uploadError
  }

  const { error } = await client.from('wl_custom_exercises').insert({
    id: customId,
    user_id: auth.userId,
    name: input.name.trim(),
    muscle_group: input.muscleGroup.trim() || 'other',
    image_path: imagePath,
  })
  if (error) {
    if (imagePath) await client.storage.from('workout-exercise-images').remove([imagePath])
    throw error
  }
  return loadSnapshot(auth)
}

export async function saveSession(
  auth: AuthState,
  currentSnapshot: AppSnapshot,
  day: WorkoutDay,
  exercises: SessionDraftExercise[],
): Promise<AppSnapshot> {
  const now = new Date().toISOString()
  const workoutDate = localDate()
  const sessionId = id()
  const flatLogs: SetLog[] = exercises.flatMap((exercise) =>
    exercise.sets.map((set) => ({
      id: id(),
      userId: auth.userId,
      sessionId,
      dayExerciseId: exercise.id,
      exerciseKey: exercise.key,
      exerciseName: exercise.name,
      performedAt: now,
      workoutDate,
      setNumber: set.setNumber,
      reps: set.reps,
      weightKg: set.weightKg,
      completed: set.completed,
    })),
  )

  if (auth.mode === 'local' || !auth.userId) {
    return saveLocal({ ...currentSnapshot, logs: [...flatLogs, ...currentSnapshot.logs] })
  }

  const client = requireClient()
  const { error } = await client.rpc('wl_save_session', {
    p_session_id: sessionId,
    p_day_id: day.id,
    p_day_name: day.name,
    p_performed_at: now,
    p_workout_date: workoutDate,
    p_logs: flatLogs.map((log) => ({
      id: log.id,
      day_exercise_id: log.dayExerciseId,
      exercise_key: log.exerciseKey,
      exercise_name: log.exerciseName,
      set_number: log.setNumber,
      reps: log.reps,
      weight_kg: log.weightKg,
      completed: log.completed,
    })),
  })
  if (error) throw error
  return loadSnapshot(auth)
}

