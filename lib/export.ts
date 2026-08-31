import { findBuiltInExercise } from './library'
import type { SetLog } from './types'

/** Character budget, not a token budget — every platform states its cutoff in
 *  characters. 5,000 is deliberately below ChatGPT's current 10,000 attachment
 *  threshold: that threshold was 5,000 as recently as March 2026, has already
 *  differed by tier mid-rollout, and WHOOP publishes no limit at all. Budgeting
 *  to the lowest recently-published number costs nothing and survives a change.
 *
 *  The failure this guards against is silent. Over the limit, ChatGPT does not
 *  error and does not truncate — it converts the paste to a file attachment and
 *  then answers by keyword-retrieving fragments of it. You get a confident
 *  answer drawn from part of your history with no sign anything was dropped. */
export const SAFE_CHARS = 5000
export const HARD_CHARS = 8000
/** Session lines kept per exercise in the digest: the first, then the most
 *  recent eight. This is what makes the digest bounded rather than linear. */
const MAX_SESSION_LINES = 9

export type ExportRange = 7 | 28 | 90 | 0 // 0 = all time

export interface ExportResult {
  text: string
  chars: number
  format: 'full' | 'digest'
  /** true when the full log was too long and we fell back to the digest */
  switched: boolean
  sets: number
  sessions: number
  overBudget: boolean
}

const MMDD = (iso: string) => iso.slice(5)
const DAYMON = new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short' })
const dayMon = (iso: string) => DAYMON.format(new Date(`${iso}T12:00:00`))

function isPerHand(key: string): boolean {
  return findBuiltInExercise(key)?.perHand === true
}

/** Trailing zeros cost characters and tokens for nothing: 82.50 -> 82.5, 60.0 -> 60 */
const num = (n: number) => String(Math.round(n * 100) / 100)

export function withinRange(logs: SetLog[], days: ExportRange): SetLog[] {
  if (!days) return [...logs]
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const floor = cutoff.toISOString().slice(0, 10)
  return logs.filter((log) => log.workoutDate >= floor)
}

/** Every exercise that actually has a completed set in this window. */
export function loggedExercises(logs: SetLog[]): Array<{ key: string; name: string; sets: number }> {
  const byKey = new Map<string, { key: string; name: string; sets: number }>()
  for (const log of logs) {
    if (!log.completed) continue
    const found = byKey.get(log.exerciseKey)
    if (found) found.sets += 1
    else byKey.set(log.exerciseKey, { key: log.exerciseKey, name: log.exerciseName, sets: 1 })
  }
  return [...byKey.values()].sort((a, b) => b.sets - a.sets)
}

/** Sets of one exercise in one session, in order, collapsed by weight.
 *  82.5x6,6,5 77.5x8  =  three sets at 82.5 then a back-off set at 77.5 */
function collapse(sets: SetLog[]): string {
  const groups: string[] = []
  let weight: number | null = null
  let reps: string[] = []
  const flush = () => {
    if (weight !== null && reps.length) groups.push(`${num(weight)}x${reps.join(',')}`)
  }
  for (const set of [...sets].sort((a, b) => a.setNumber - b.setNumber)) {
    if (set.weightKg !== weight) {
      flush()
      weight = set.weightKg
      reps = []
    }
    reps.push(`${set.reps}${set.completed ? '' : '!'}`)
  }
  flush()
  return groups.join(' ')
}

function bySession(logs: SetLog[]): Array<{ at: string; date: string; sets: SetLog[] }> {
  const map = new Map<string, { at: string; date: string; sets: SetLog[] }>()
  for (const log of logs) {
    const found = map.get(log.sessionId)
    if (found) {
      found.sets.push(log)
      if (log.performedAt < found.at) found.at = log.performedAt
    } else {
      map.set(log.sessionId, { at: log.performedAt, date: log.workoutDate, sets: [log] })
    }
  }
  return [...map.values()].sort((a, b) => a.at.localeCompare(b.at))
}

/** Groups an exercise's sets within a session, preserving the order the
 *  exercises were performed in. */
function byExercise(sets: SetLog[]): Array<{ key: string; name: string; sets: SetLog[] }> {
  const order: string[] = []
  const map = new Map<string, { key: string; name: string; sets: SetLog[] }>()
  for (const set of [...sets].sort((a, b) => a.performedAt.localeCompare(b.performedAt) || a.setNumber - b.setNumber)) {
    const found = map.get(set.exerciseKey)
    if (found) found.sets.push(set)
    else {
      map.set(set.exerciseKey, { key: set.exerciseKey, name: set.exerciseName, sets: [set] })
      order.push(set.exerciseKey)
    }
  }
  return order.map((k) => map.get(k)!)
}

/** THE DEFAULT. Every set, nothing lost, ~10 characters per set instead of 60 —
 *  because the date is written once per session and the exercise name once per
 *  exercise, instead of on every single line. */
function buildFull(logs: SetLog[]): string {
  const sessions = bySession(logs)
  if (sessions.length === 0) return ''
  const from = sessions[0].date
  const to = sessions[sessions.length - 1].date

  const legend =
    `WORKOUT LOG ${from}>${to} | kg, dates MM-DD | ` +
    `EXERCISE WEIGHTxREPS,REPS,... = one entry per set in order, a new weight starts a new group | ` +
    `! = set not completed | [ph] = weight is per hand, double for total`

  const blocks = sessions.map((session) => {
    const lines = byExercise(session.sets).map((ex) => {
      const tag = isPerHand(ex.key) ? '[ph]' : ''
      return `${ex.name}${tag} ${collapse(ex.sets)}`
    })
    return [MMDD(session.date), ...lines].join('\n')
  })

  return [legend, ...blocks].join('\n\n')
}

/** THE FALLBACK. Size stops growing with the window, because it reports per
 *  exercise rather than per set — so it is the only honest answer to 90 days
 *  and all time. */
function buildDigest(logs: SetLog[]): string {
  const completed = logs.filter((log) => log.completed)
  if (completed.length === 0) return ''
  const sessions = bySession(logs)
  const from = sessions[0]?.date ?? ''
  const to = sessions[sessions.length - 1]?.date ?? ''

  const head = [
    `TRAINING DIGEST ${from}>${to} | ${sessions.length} sessions | kg`,
    `BEST = heaviest set in the window, with the change since the first session.`,
    `Sessions oldest first: date  topWeight reps/reps/reps. ! = not completed. [ph] = per hand.`,
  ].join('\n')

  const keys: string[] = []
  const byKey = new Map<string, SetLog[]>()
  for (const log of completed) {
    const found = byKey.get(log.exerciseKey)
    if (found) found.push(log)
    else { byKey.set(log.exerciseKey, [log]); keys.push(log.exerciseKey) }
  }

  const blocks = keys.map((key) => {
    const all = byKey.get(key)!
    const name = all[0].exerciseName + (isPerHand(key) ? '[ph]' : '')
    const best = all.reduce((a, b) => (b.weightKg > a.weightKg ? b : a))

    // One line per session: the heaviest weight that session, and the reps done at it.
    const perSession = bySession(all).map((s) => {
      const top = s.sets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a)).weightKg
      const reps = s.sets
        .filter((x) => x.weightKg === top)
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((x) => `${x.reps}${x.completed ? '' : '!'}`)
        .join('/')
      return { date: s.date, top, reps }
    })

    const first = perSession[0]
    const delta = first ? best.weightKg - first.top : 0
    const change = first && delta !== 0 ? ` (${delta > 0 ? '+' : '−'}${num(Math.abs(delta))}kg)` : ''

    // The digest only earns its place if its size STOPS growing with the
    // window. Printing every session made a year longer than the raw log it was
    // supposed to replace. Keep the first session as the trend anchor and the
    // last eight for recency, and say plainly what was dropped.
    const render = (s: { date: string; top: number; reps: string }) =>
      `  ${dayMon(s.date)}  ${num(s.top)} ${s.reps}`
    let lines: string[]
    if (perSession.length > MAX_SESSION_LINES) {
      const tail = perSession.slice(-(MAX_SESSION_LINES - 1))
      const omitted = perSession.length - 1 - tail.length
      lines = [render(perSession[0]), `  … ${omitted} sessions between`, ...tail.map(render)]
    } else {
      lines = perSession.map(render)
    }
    return [`${name}  BEST ${num(best.weightKg)}x${best.reps}${change}  ${perSession.length} sess`, ...lines].join('\n')
  })

  return [head, ...blocks].join('\n\n')
}

/** Build the export, measure it, and fall back to the digest if the full log
 *  would not survive a paste. The switch is on the MEASURED length, never on
 *  the range — a week of high-volume training can be longer than a quiet month. */
export function buildExport(
  allLogs: SetLog[],
  options: { days: ExportRange; exerciseKeys?: string[] | null },
): ExportResult {
  let logs = withinRange(allLogs, options.days)
  if (options.exerciseKeys && options.exerciseKeys.length > 0) {
    const keep = new Set(options.exerciseKeys)
    logs = logs.filter((log) => keep.has(log.exerciseKey))
  }

  const sessions = bySession(logs).length
  const sets = logs.length

  const full = buildFull(logs)
  if (!full) {
    return { text: '', chars: 0, format: 'full', switched: false, sets: 0, sessions: 0, overBudget: false }
  }
  if (full.length <= SAFE_CHARS) {
    return { text: full, chars: full.length, format: 'full', switched: false, sets, sessions, overBudget: false }
  }

  const digest = buildDigest(logs)
  const text = digest || full
  return {
    text,
    chars: text.length,
    format: digest ? 'digest' : 'full',
    switched: Boolean(digest),
    sets,
    sessions,
    overBudget: text.length > HARD_CHARS,
  }
}
