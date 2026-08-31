import type { PlannedExercise } from './types'

/** What a balanced day of each family usually touches. Used to name what is
 *  missing, never to block anything. */
const EXPECTED: Record<string, string[]> = {
  push: ['chest', 'shoulders', 'triceps'],
  pull: ['back', 'biceps'],
  legs: ['quads', 'hamstrings', 'glutes'],
}

/** The patterns worth warning about when a day is nothing but one of them.
 *  Isolation and core are excluded — five isolation moves is a choice, five
 *  incline presses is usually an accident. */
const COMPOUND_PATTERNS = new Set([
  'horizontal-press', 'incline-press', 'overhead-press',
  'vertical-pull', 'horizontal-row',
  'squat', 'hinge', 'lunge',
])

const PATTERN_PHRASE: Record<string, string> = {
  'horizontal-press': 'flat pressing',
  'incline-press': 'incline pressing',
  'overhead-press': 'overhead pressing',
  'vertical-pull': 'vertical pulling',
  'horizontal-row': 'rowing',
  squat: 'squatting',
  hinge: 'hinging',
  lunge: 'lunging',
}

/** The day's dominant family (push / pull / legs), by simple majority of its
 *  lifting exercises. Core and untagged rows do not vote. */
export function dayFamily(exercises: PlannedExercise[]): string | null {
  const votes = new Map<string, number>()
  for (const exercise of exercises) {
    const group = exercise.muscleGroup
    if (group !== 'push' && group !== 'pull' && group !== 'legs') continue
    votes.set(group, (votes.get(group) ?? 0) + 1)
  }
  let best: string | null = null
  let max = 0
  for (const [group, count] of votes) {
    if (count > max) { best = group; max = count }
  }
  return best
}

/** One quiet sentence about the day, or null — which is the common case.
 *  Rules, so it never nags:
 *   - silent under 3 lifting exercises (a half-built day is not a problem)
 *   - silent when the day already touches every expected region
 *   - the pattern warning needs 3+ compounds ALL sharing one pattern
 *   - never more than one line; the pattern warning outranks the gap line */
export function balanceLine(exercises: PlannedExercise[]): string | null {
  const lifts = exercises.filter((e) => e.region && e.region !== 'core')
  if (lifts.length < 3) return null

  // Every compound is the same movement.
  const compounds = lifts.filter((e) => e.pattern && COMPOUND_PATTERNS.has(e.pattern))
  if (compounds.length >= 3) {
    const patterns = new Set(compounds.map((e) => e.pattern))
    if (patterns.size === 1) {
      const phrase = PATTERN_PHRASE[compounds[0].pattern as string]
      if (phrase) return `Every compound here is ${phrase}.`
    }
  }

  // A whole expected region untouched while another is stacked.
  const family = dayFamily(exercises)
  const expected = family ? EXPECTED[family] : null
  if (expected) {
    const counts = new Map<string, number>()
    for (const lift of lifts) counts.set(lift.region as string, (counts.get(lift.region as string) ?? 0) + 1)
    const missing = expected.filter((region) => !counts.has(region))
    const heaviest = Math.max(...expected.map((region) => counts.get(region) ?? 0))
    if (missing.length > 0 && heaviest >= 3) {
      const covered = expected.find((region) => (counts.get(region) ?? 0) === heaviest)
      const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} or ${missing.at(-1)}`
      return `All ${covered} so far — nothing for ${list} yet.`
    }
  }

  return null
}

/** Orders the Add library for the day being built: exercises from the day's
 *  own family first, everything else after, both keeping their existing order.
 *  With no family yet (empty day), the list is untouched. */
export function sortForDay<T extends { muscleGroup: string }>(options: T[], exercises: PlannedExercise[]): T[] {
  const family = dayFamily(exercises)
  if (!family) return options
  const same: T[] = []
  const rest: T[] = []
  for (const option of options) (option.muscleGroup === family ? same : rest).push(option)
  return [...same, ...rest]
}
