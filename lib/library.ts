import { CATEGORY_GROUPS, EX } from './exercise-library'
import type { ExerciseOption } from './types'

const groupByKey = new Map<string, string>()
for (const [group, buckets] of Object.entries(CATEGORY_GROUPS)) {
  if (group === 'upper' || group === 'lower' || group === 'rest') continue
  for (const key of [...buckets.compounds, ...buckets.isolation]) {
    if (!groupByKey.has(key)) groupByKey.set(key, group)
  }
}

export const BUILT_IN_EXERCISES: ExerciseOption[] = Object.entries(EX)
  .map(([key, definition]) => ({
    key,
    name: definition.name,
    muscleGroup: groupByKey.get(key) ?? (definition.tier === 'ab' ? 'core' : 'other'),
    imageUrl: `/exercise-refs/${key}/0.jpg`,
    // Every built-in has two reference frames: 0 is the start of the rep, 1 the end.
    imageUrlEnd: `/exercise-refs/${key}/1.jpg`,
    tip: definition.tip,
    perHand: definition.perHand ?? false,
    region: definition.region,
    pattern: definition.pattern,
    customExerciseId: null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

export const DEFAULT_EXERCISE_KEYS = {
  Push: ['bench_bb', 'incl_db_press', 'standing_ohp'],
  Pull: ['pullup_weighted', 'bb_row', 'lat_pulldown'],
  Legs: ['back_squat', 'rdl', 'leg_press'],
} as const

export function findBuiltInExercise(key: string): ExerciseOption | undefined {
  return BUILT_IN_EXERCISES.find((exercise) => exercise.key === key)
}
