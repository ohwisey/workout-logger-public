export type ViewName = 'plan' | 'log' | 'history'

export interface ExerciseOption {
  key: string
  name: string
  muscleGroup: string
  imageUrl: string | null
  customExerciseId?: string | null
  /** One line of form. Shown when you tap the picture. */
  tip?: string
  /** Second reference photo — the end of the rep, where 0 is the start. */
  imageUrlEnd?: string | null
  /** Logged weight is per hand, not total. Worth knowing before you load up. */
  perHand?: boolean
  /** Primary muscle, and how the weight moves. Together these drive the
   *  balance line on the Plan screen. */
  region?: string
  pattern?: string
}

export interface PlannedExercise extends ExerciseOption {
  id: string
  dayId: string
  position: number
  targetSets: number
  targetReps: number
  targetWeightKg: number
}

export interface WorkoutDay {
  id: string
  name: string
  position: number
  exercises: PlannedExercise[]
}

export interface SetDraft {
  setNumber: number
  reps: number
  weightKg: number
  completed: boolean
}

export interface SessionDraftExercise extends PlannedExercise {
  sets: SetDraft[]
}

export interface SetLog {
  id: string
  userId: string | null
  sessionId: string
  dayExerciseId: string | null
  exerciseKey: string
  exerciseName: string
  performedAt: string
  workoutDate: string
  setNumber: number
  reps: number
  weightKg: number
  completed: boolean
}

export interface AppSnapshot {
  days: WorkoutDay[]
  customExercises: ExerciseOption[]
  logs: SetLog[]
}

export interface NewCustomExercise {
  name: string
  muscleGroup: string
  image: File | null
}

export interface AuthState {
  userId: string | null
  email: string | null
  mode: 'cloud' | 'local'
}
