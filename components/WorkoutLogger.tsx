'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isLocalModeEnabled, clearLocalMode } from '@/lib/auth-mode'
import { uid } from '@/lib/uid'
import { buildExport, loggedExercises, withinRange, SAFE_CHARS, type ExportRange } from '@/lib/export'
import { balanceLine, sortForDay } from '@/lib/balance'
import { BUILT_IN_EXERCISES } from '@/lib/library'
import { getSupabaseBrowserClient, hasSupabaseConfig } from '@/lib/supabase/client'
import type {
  AppSnapshot,
  AuthState,
  ExerciseOption,
  NewCustomExercise,
  SessionDraftExercise,
  SetDraft,
  SetLog,
  ViewName,
  WorkoutDay,
} from '@/lib/types'
import {
  addWorkoutDay,
  createCustomExercise,
  loadSnapshot,
  saveSession,
  saveWorkoutDay,
} from '@/lib/workout-repository'

const LOCAL_AUTH: AuthState = { userId: null, email: null, mode: 'local' }
const MAX_WEIGHT_KG = 999_999.99

function isValidSetNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 30
}

function isValidReps(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 500
}

function isValidWeight(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_WEIGHT_KG
}


// aria-modal="true" only TELLS assistive tech a dialog is modal; it does not
// make it one. Without this, focus stayed on the page behind the backdrop and
// could drive controls covered by it — one Tab then Enter added an exercise
// while the dialog was still open. Moves focus in, traps Tab, restores it on
// close, and wires Escape.
function useModalFocus(onClose: () => void) {
  const ref = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const node = ref.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusable = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )

    focusable()[0]?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [])

  return ref
}

function makeSession(day: WorkoutDay): SessionDraftExercise[] {
  return day.exercises.map((exercise) => ({
    ...exercise,
    sets: Array.from({ length: exercise.targetSets }, (_, index) => ({
      setNumber: index + 1,
      reps: exercise.targetReps,
      weightKg: exercise.targetWeightKg,
      completed: false,
    })),
  }))
}

export function WorkoutLogger() {
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [view, setView] = useState<ViewName>('plan')
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [session, setSession] = useState<SessionDraftExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const toastTimer = useRef<number | undefined>(undefined)
  const router = useRouter()

  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current) }, [])

  useEffect(() => {
    const client = getSupabaseBrowserClient()
    if (!client) {
      setAuth(LOCAL_AUTH)
      return
    }
    client.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setAuth({ userId: data.session.user.id, email: data.session.user.email ?? null, mode: 'cloud' })
      } else if (isLocalModeEnabled()) {
        setAuth(LOCAL_AUTH)
      } else {
        setLoading(false)
        router.replace('/login')
      }
    })
    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      if (nextSession?.user) {
        const userId = nextSession.user.id
        const email = nextSession.user.email ?? null
        // Replace the object only when it actually changed. TOKEN_REFRESHED
        // fires on a timer and whenever the tab is re-foregrounded; a fresh
        // object literal here reloaded the snapshot and wiped the sets you had
        // already ticked mid-workout.
        setAuth((current) =>
          current?.mode === 'cloud' && current.userId === userId && current.email === email
            ? current
            : { userId, email, mode: 'cloud' },
        )
        return
      }
      // Only an explicit sign-out ends the session. A missing session on any other
      // event (a slow refresh, a transient network failure) must never log anyone out.
      if (event !== 'SIGNED_OUT') return
      if (isLocalModeEnabled()) {
        setAuth(LOCAL_AUTH)
        return
      }
      setAuth(null)
      setSnapshot(null)
      setSelectedDayId(null)
      setSession([])
      setLoading(false)
      router.replace('/login')
    })
    return () => listener.subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    if (!auth) return
    setLoading(true)
    loadSnapshot(auth)
      .then((next) => {
        setSnapshot(next)
        setSelectedDayId((current) => current ?? next.days[0]?.id ?? null)
      })
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false))
  }, [auth])

  const selectedDay = snapshot?.days.find((day) => day.id === selectedDayId) ?? snapshot?.days[0]

  const selectedDayRef = useRef(selectedDay)
  selectedDayRef.current = selectedDay
  const activeDayId = selectedDay?.id
  // Keyed on the day ID, not the object. Every snapshot reload rebuilds the day
  // objects, and resetting on identity threw away a workout in progress.
  useEffect(() => {
    const day = selectedDayRef.current
    if (day) setSession(makeSession(day))
  }, [activeDayId])

  if (!snapshot || !selectedDay || !auth) {
    // The toast lives below this early return, so without this branch a failed
    // load showed a spinner forever with no reason and no way out.
    return (
      <main className="center-page">
        {message ? (
          <>
            <p className="quiet-note error">{message}</p>
            <button className="text-button" onClick={() => window.location.reload()}>Try again</button>
          </>
        ) : (
          <>
            <div className="loader" />
            <p>{auth ? 'Loading your workouts…' : 'Taking you to sign in…'}</p>
          </>
        )}
      </main>
    )
  }

  async function perform(action: () => Promise<AppSnapshot>, success: string) {
    setLoading(true)
    setMessage(null)
    try {
      const next = await action()
      setSnapshot(next)
      setMessage(success)
      // One timer, replaced each time — otherwise an earlier action's timer
      // clears a later action's message, and it fires after unmount.
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setMessage(null), 2600)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    setShowSettings(false)
    if (auth?.mode === 'cloud') await getSupabaseBrowserClient()?.auth.signOut()
    clearLocalMode()
    setSnapshot(null)
    setSelectedDayId(null)
    setSession([])
    if (!hasSupabaseConfig()) {
      setAuth(LOCAL_AUTH)
      return
    }
    setAuth(null)
    router.replace('/login')
  }

  return (
    <main className="page-shell">
      <section className="product-copy" aria-label="App summary">
        <h1>Workout log.</h1>
        <div className="flow-line"><b>Plan</b> <span>·</span> <b>Log</b> <span>·</span> <b>History</b></div>
      </section>

      <section className="app-frame" aria-label="Workout logger app">
        <header className="app-header">
          <div>
            <span className="micro-label">WORKOUT LOG</span>
            <strong>{view === 'log' ? selectedDay.name : view === 'plan' ? 'Plan' : 'History'}</strong>
          </div>
          <button className="icon-button" onClick={() => setShowSettings(true)} aria-label="Settings" title="Settings">
            {auth.mode === 'cloud' ? auth.email?.slice(0, 1).toUpperCase() : 'L'}
          </button>
        </header>

        <StatusStrip session={session} logs={snapshot.logs} />

        <DayStrip days={snapshot.days} selectedId={selectedDay.id} onSelect={setSelectedDayId} />

        <div className="view-scroll">
          {view === 'plan' && (
            <PlanView
              auth={auth}
              snapshot={snapshot}
              day={selectedDay}
              loading={loading}
              onSave={(day) => perform(() => saveWorkoutDay(auth, snapshot, day), 'Plan saved.')}
              onAddDay={(name) =>
                perform(async () => {
                  const next = await addWorkoutDay(auth, snapshot, name)
                  setSelectedDayId(next.days.at(-1)?.id ?? selectedDay.id)
                  return next
                }, 'Day added.')
              }
              onCreateCustom={(input) =>
                perform(() => createCustomExercise(auth, snapshot, input), 'Exercise created. It now has its own history.')
              }
            />
          )}
          {view === 'log' && (
            <LogView
              day={selectedDay}
              logs={snapshot.logs}
              exercises={session}
              setExercises={setSession}
              loading={loading}
              onSave={() =>
                perform(async () => {
                  const next = await saveSession(auth, snapshot, selectedDay, session)
                  setSession(makeSession(selectedDay))
                  setView('history')
                  return next
                }, 'Workout saved to your history.')
              }
            />
          )}
          {view === 'history' && <HistoryView snapshot={snapshot} />}
        </div>

        <nav className="bottom-nav" aria-label="App views">
          <NavButton active={view === 'plan'} label="Plan" onClick={() => setView('plan')} />
          <NavButton active={view === 'log'} label="Log" onClick={() => setView('log')} />
          <NavButton active={view === 'history'} label="History" onClick={() => setView('history')} />
        </nav>
      </section>

      {showSettings && (
        <SettingsModal auth={auth} onClose={() => setShowSettings(false)} onLogout={logout} />
      )}

      {message && <div className="toast" role="status">{message}</div>}
    </main>
  )
}

function SettingsModal({ auth, onClose, onLogout }: { auth: AuthState; onClose: () => void; onLogout: () => void }) {
  const modalRef = useModalFocus(onClose)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header>
          <div><span className="micro-label">ACCOUNT</span><h2 id="settings-title">Settings</h2></div>
          <button className="remove-button" onClick={onClose} aria-label="Close settings">×</button>
        </header>

        <div className="settings-row">
          <span>Mode</span>
          <strong>{auth.mode === 'cloud' ? 'Cloud sync' : 'Local only'}</strong>
        </div>
        {auth.mode === 'cloud' && (
          <div className="settings-row">
            <span>Signed in as</span>
            <strong>{auth.email ?? 'Your account'}</strong>
          </div>
        )}

        {confirming ? (
          <>
            <button className="danger-button" onClick={onLogout}>Yes, log out</button>
            <button className="text-button" onClick={() => setConfirming(false)}>Cancel</button>
          </>
        ) : (
          <button className="secondary-button" onClick={() => setConfirming(true)}>Log out</button>
        )}
      </section>
    </div>
  )
}

const SHORT_DATE = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })

// Instrumentation, not navigation: three readouts computed from data the app
// already holds. Nothing here is tappable.
function StatusStrip({ session, logs }: { session: SessionDraftExercise[]; logs: SetLog[] }) {
  const { done, total, volume } = useMemo(() => {
    let done = 0
    let total = 0
    let volume = 0
    for (const exercise of session) {
      for (const set of exercise.sets) {
        total += 1
        if (!set.completed) continue
        done += 1
        volume += set.weightKg * set.reps
      }
    }
    return { done, total, volume }
  }, [session])

  const last = useMemo(() => {
    const dates = logs.map((log) => log.workoutDate).sort()
    const latest = dates.at(-1)
    return latest ? SHORT_DATE.format(new Date(`${latest}T12:00:00`)).toUpperCase() : '—'
  }, [logs])

  return (
    // Not aria-hidden: it carries the set fraction that used to live in the Log
    // header, so hiding it would leave a screen reader with no progress at all.
    <div className="status-strip" role="group" aria-label="Session readout">
      <span>SETS {done}/{total}</span>
      <span>VOL {Math.round(volume).toLocaleString('en-US')} KG</span>
      <span>LAST {last}</span>
    </div>
  )
}

function DayStrip({ days, selectedId, onSelect }: { days: WorkoutDay[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="day-strip" role="tablist" aria-label="Workout days">
      {days.map((day) => (
        <button key={day.id} className={day.id === selectedId ? 'active' : ''} onClick={() => onSelect(day.id)} role="tab">
          {day.name}
        </button>
      ))}
    </div>
  )
}

function PlanView({
  snapshot,
  day,
  loading,
  onSave,
  onAddDay,
  onCreateCustom,
}: {
  auth: AuthState
  snapshot: AppSnapshot
  day: WorkoutDay
  loading: boolean
  onSave: (day: WorkoutDay) => void
  onAddDay: (name: string) => void
  onCreateCustom: (input: NewCustomExercise) => void
}) {
  const [draft, setDraft] = useState(day)
  const [search, setSearch] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [formFor, setFormFor] = useState<ExerciseOption | null>(null)

  const dayRef = useRef(day)
  dayRef.current = day
  const planDayId = day.id
  // Keyed on the day ID: creating a custom exercise reloads the whole snapshot,
  // and resetting on object identity silently discarded unsaved plan edits.
  useEffect(() => { setDraft(dayRef.current) }, [planDayId])

  const available = useMemo(() => {
    const all = [...snapshot.customExercises, ...BUILT_IN_EXERCISES]
    const query = search.trim().toLowerCase()
    // On a Push day the push exercises come first — the day's own family leads,
    // the rest stay reachable below. Search ignores the ordering entirely.
    const matches = all
      .filter((exercise) => !draft.exercises.some((planned) => planned.key === exercise.key))
      .filter((exercise) => !query || `${exercise.name} ${exercise.muscleGroup} ${exercise.region ?? ''}`.toLowerCase().includes(query))
    // 120, not 60: under relevance sorting a cap below the library size would
    // hide exactly the off-family exercises the sort pushed to the tail.
    return (query ? matches : sortForDay(matches, draft.exercises)).slice(0, showLibrary || query ? 120 : 8)
  }, [draft.exercises, search, showLibrary, snapshot.customExercises])

  const balance = useMemo(() => balanceLine(draft.exercises), [draft.exercises])

  function addExercise(exercise: ExerciseOption) {
    setDraft((current) => ({
      ...current,
      exercises: [
        ...current.exercises,
        {
          ...exercise,
          id: uid(),
          dayId: current.id,
          position: current.exercises.length,
          targetSets: 3,
          targetReps: 10,
          targetWeightKg: 0,
        },
      ],
    }))
  }

  function changeExercise(id: string, patch: Partial<{ targetSets: number; targetReps: number; targetWeightKg: number }>) {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => (exercise.id === id ? { ...exercise, ...patch } : exercise)),
    }))
  }

  const planIsValid =
    draft.name.trim().length >= 1 &&
    draft.name.trim().length <= 80 &&
    draft.exercises.every(
      (exercise) =>
        isValidSetNumber(exercise.targetSets) &&
        isValidReps(exercise.targetReps) &&
        isValidWeight(exercise.targetWeightKg),
    )

  return (
    <div className="view-stack">
      <div className="section-heading">
        <div><span className="micro-label">TODAY</span></div>
        <input className="day-name-input" maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-label="Workout day name" />
      </div>

      <div className="planned-list">
        {draft.exercises.map((exercise) => (
          <article className="planned-row" key={exercise.id}>
            <div className="planned-main"><strong>{exercise.name}</strong><span>{exercise.region ?? exercise.muscleGroup}</span></div>
            <NumberField label="sets" value={exercise.targetSets} min={1} max={30} onChange={(targetSets) => changeExercise(exercise.id, { targetSets })} />
            <NumberField label="reps" value={exercise.targetReps} min={0} max={500} onChange={(targetReps) => changeExercise(exercise.id, { targetReps })} />
            <NumberField label="kg" value={exercise.targetWeightKg} min={0} max={MAX_WEIGHT_KG} step={2.5} onChange={(targetWeightKg) => changeExercise(exercise.id, { targetWeightKg })} />
            <button className="remove-button" onClick={() => setDraft({ ...draft, exercises: draft.exercises.filter((item) => item.id !== exercise.id) })} aria-label={`Remove ${exercise.name}`}>×</button>
          </article>
        ))}
      </div>

      {/* One quiet line, muted, no icon, no colour. Silent under three lifts,
          silent when the day is balanced, and it never blocks anything. */}
      {balance && <p className="balance-line">{balance}</p>}

      <div className="library-head">
        <div><span className="micro-label">ADD</span></div>
        <button className="mini-button" onClick={() => setShowCustom(true)}>＋ Create</button>
      </div>
      <input className="search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises" />
      <div className="exercise-grid">
        {available.map((exercise) => (
          // The picture is its own target: tap it to see the form, tap the rest
          // of the row to add the exercise.
          <div className="exercise-card" key={exercise.key}>
            <button className="thumb-button" onClick={() => setFormFor(exercise)} aria-label={`How to do ${exercise.name}`}>
              <ExerciseThumb exercise={exercise} />
            </button>
            <button className="exercise-add" onClick={() => addExercise(exercise)}>
              <span><strong>{exercise.name}</strong><small>{exercise.region ?? exercise.muscleGroup}</small></span>
              <b>＋</b>
            </button>
          </div>
        ))}
      </div>
      {!search && <button className="text-button" onClick={() => setShowLibrary((value) => !value)}>{showLibrary ? 'Show less' : 'See the full library'}</button>}

      {!planIsValid && <p className="quiet-note error">Use 1–30 sets, 0–500 reps, and a non-negative weight.</p>}
      <button className="text-button" onClick={() => onAddDay(`Day ${snapshot.days.length + 1}`)}>＋ Add another day</button>
      {/* Last child, so the docked band never covers anything below it. */}
      <div className="action-dock">
        <button className="primary-button" disabled={loading || !planIsValid} onClick={() => onSave({ ...draft, name: draft.name.trim(), exercises: draft.exercises.map((item, position) => ({ ...item, position })) })}>Save day</button>
      </div>

      {showCustom && <CustomExerciseModal onClose={() => setShowCustom(false)} onCreate={(input) => { onCreateCustom(input); setShowCustom(false) }} />}
      {formFor && (
        <ExerciseFormModal
          exercise={formFor}
          onClose={() => setFormFor(null)}
          onAdd={() => { addExercise(formFor); setFormFor(null) }}
        />
      )}
    </div>
  )
}

// Tap a picture and this is what you get: the two reference frames, one line of
// form, and the one thing that would make you load the bar wrong. Nothing else
// — no sets, no history, no coaching.
function ExerciseFormModal({ exercise, onClose, onAdd }: { exercise: ExerciseOption; onClose: () => void; onAdd: () => void }) {
  const modalRef = useModalFocus(onClose)
  const frames = [
    { url: exercise.imageUrl, label: 'START' },
    { url: exercise.imageUrlEnd ?? null, label: 'END' },
  ].filter((frame) => frame.url)

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <header>
          <div>
            <span className="micro-label">{exercise.muscleGroup.toUpperCase()}</span>
            <h2 id="form-title">{exercise.name}</h2>
          </div>
          <button className="remove-button" onClick={onClose} aria-label="Close">×</button>
        </header>

        {frames.length > 0 && (
          <div className={`form-frames ${frames.length === 1 ? 'single' : ''}`}>
            {frames.map((frame) => (
              <figure key={frame.label}>
                {/* Local assets and expiring private signed URLs both land here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={frame.url as string} alt={`${exercise.name}, ${frame.label.toLowerCase()} of the rep`} onError={(event) => { event.currentTarget.style.visibility = 'hidden' }} />
                <figcaption>{frame.label}</figcaption>
              </figure>
            ))}
          </div>
        )}

        {exercise.tip && <p className="form-cue">{exercise.tip}</p>}
        {exercise.perHand && <p className="form-note">Weight is per hand, not the total</p>}

        <button className="primary-button" onClick={onAdd}>Add to this day</button>
      </section>
    </div>
  )
}

function LogView({
  day,
  logs,
  exercises,
  setExercises,
  loading,
  onSave,
}: {
  day: WorkoutDay
  logs: SetLog[]
  exercises: SessionDraftExercise[]
  setExercises: React.Dispatch<React.SetStateAction<SessionDraftExercise[]>>
  loading: boolean
  onSave: () => void
}) {
  const [historyFor, setHistoryFor] = useState<SessionDraftExercise | null>(null)
  const total = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  const done = exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0)

  // Weight lifted for each set the last time this exercise was actually
  // trained. Three things matter here and each one was a bug:
  //   - only COMPLETED sets count, on both passes. saveSession writes a row for
  //     every set including unticked ones, so ranking on all rows let a skipped
  //     session become "last time" and blank the whole column for that lift.
  //   - the winner is picked by performedAt and then matched by sessionId, not
  //     by date, so two workouts on the same day resolve to the later one.
  //   - "last time" means the most recent completed session, which after you
  //     save today is today. That is correct, not a bug.
  const previous = useMemo(() => {
    const latest = new Map<string, { at: string; sessionId: string }>()
    for (const log of logs) {
      if (!log.completed) continue
      const seen = latest.get(log.exerciseKey)
      if (!seen || log.performedAt > seen.at) {
        latest.set(log.exerciseKey, { at: log.performedAt, sessionId: log.sessionId })
      }
    }
    const byKey = new Map<string, Map<number, number>>()
    for (const log of logs) {
      if (!log.completed || latest.get(log.exerciseKey)?.sessionId !== log.sessionId) continue
      const sets = byKey.get(log.exerciseKey) ?? new Map<number, number>()
      sets.set(log.setNumber, log.weightKg)
      byKey.set(log.exerciseKey, sets)
    }
    return byKey
  }, [logs])
  const sessionIsValid = exercises.every((exercise) =>
    exercise.sets.every((set) => isValidReps(set.reps) && isValidWeight(set.weightKg)),
  )

  function updateSet(exerciseId: string, setNumber: number, patch: Partial<SetDraft>) {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, sets: exercise.sets.map((set) => (set.setNumber === setNumber ? { ...set, ...patch } : set)) }
          : exercise,
      ),
    )
  }

  return (
    <div className="view-stack">
      {/* The set fraction lives in the status strip now — saying it twice was
          the old progress bar's only job. */}
      <div className="progress-header">
        <div><h2>{day.name}</h2></div>
      </div>

      {exercises.length === 0 && <div className="empty-state"><b>No exercises yet.</b><span>Add lifts in Plan first.</span></div>}
      {exercises.map((exercise) => (
        <article className="log-card" key={exercise.id}>
          <header>
            <div>
              <button className="log-name" onClick={() => setHistoryFor(exercise)}>
                {exercise.name}<i aria-hidden="true">↗</i>
              </button>
              <span>TARGET {exercise.targetWeightKg} KG × {exercise.targetReps}</span>
            </div>
          </header>
          <div className="set-list">
            {exercise.sets.map((set) => (
              <div className={`set-row ${set.completed ? 'completed' : ''}`} key={set.setNumber}>
                <span className="set-index">{String(set.setNumber).padStart(2, '0')}</span>
                <label><input type="number" inputMode="decimal" min="0" max={MAX_WEIGHT_KG} step="2.5" value={set.weightKg} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateSet(exercise.id, set.setNumber, { weightKg: Number(event.target.value) })} /><small>KG</small></label>
                <label><input type="number" inputMode="numeric" min="0" max="500" step="1" value={set.reps} onFocus={(event) => event.currentTarget.select()} onChange={(event) => updateSet(exercise.id, set.setNumber, { reps: Number(event.target.value) })} /><small>REPS</small></label>
                <SetDelta now={set.weightKg} before={previous.get(exercise.key)?.get(set.setNumber)} />
                <button onClick={() => updateSet(exercise.id, set.setNumber, { completed: !set.completed })} aria-label={`${set.completed ? 'Uncheck' : 'Complete'} set ${set.setNumber}`}>{set.completed ? '✓' : '○'}</button>
              </div>
            ))}
          </div>
        </article>
      ))}
      {historyFor && (
        <ExerciseHistoryModal exercise={historyFor} logs={logs} onClose={() => setHistoryFor(null)} />
      )}
      {!sessionIsValid && <p className="quiet-note error">Reps must be whole numbers from 0–500. Weight cannot be negative.</p>}
      <div className="action-dock">
        <button className="primary-button" disabled={loading || total === 0 || done === 0 || !sessionIsValid} onClick={onSave}>Save workout</button>
      </div>
    </div>
  )
}

function ExerciseHistoryModal({
  exercise,
  logs,
  onClose,
}: {
  exercise: SessionDraftExercise
  logs: SetLog[]
  onClose: () => void
}) {
  const modalRef = useModalFocus(onClose)
  const mine = useMemo(
    () => logs.filter((log) => log.exerciseKey === exercise.key && log.completed),
    [logs, exercise.key],
  )
  const points = useMemo(() => historyPoints(mine), [mine])
  const best = mine.length ? Math.max(...mine.map((log) => log.weightKg)) : 0
  const byDate = useMemo(() => {
    const map = new Map<string, SetLog[]>()
    for (const log of mine) map.set(log.workoutDate, [...(map.get(log.workoutDate) ?? []), log])
    return [...map.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 6)
  }, [mine])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="exercise-history-title">
        <header>
          <div>
            <span className="micro-label">HISTORY</span>
            <h2 id="exercise-history-title">{exercise.name}</h2>
          </div>
          <button className="remove-button" onClick={onClose} aria-label="Close history">×</button>
        </header>

        {mine.length === 0 ? (
          <div className="empty-state"><b>No history yet.</b><span>Log this lift once and it appears here.</span></div>
        ) : (
          <>
            <div className="chart-summary"><span>Peak load / kg</span><strong>{best}</strong></div>
            <Sparkline values={points.map((point) => point.value)} />
            <div className="history-list">
              {byDate.map(([date, dayLogs]) => (
                <div key={date}>
                  <span>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))}</span>
                  <strong>{Math.max(...dayLogs.map((log) => log.weightKg))} kg</strong>
                  <small>{dayLogs.map((log) => `${log.weightKg}×${log.reps}`).join('  ')}</small>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function HistoryView({ snapshot }: { snapshot: AppSnapshot }) {
  const exerciseOptions = useMemo(() => {
    const byKey = new Map<string, string>()
    // Completed sets only. Unticked rows are still written on save, so without
    // this a skipped lift became the default selection and the hero readout
    // asserted a 0 kg peak for something with no history at all.
    for (const log of snapshot.logs) {
      if (!log.completed) continue
      byKey.set(log.exerciseKey, log.exerciseName)
    }
    return [...byKey.entries()].map(([key, name]) => ({ key, name }))
  }, [snapshot.logs])
  const [selectedKey, setSelectedKey] = useState<string>('')
  const activeKey = selectedKey || exerciseOptions[0]?.key || ''
  const points = useMemo(
    () => historyPoints(snapshot.logs.filter((log) => log.exerciseKey === activeKey && log.completed)),
    [snapshot.logs, activeKey],
  )
  const logs = snapshot.logs.filter((log) => log.exerciseKey === activeKey && log.completed)

  return (
    <div className="view-stack">
      <div className="section-heading"><div><span className="micro-label">HISTORY</span></div></div>
      {exerciseOptions.length === 0 ? (
        <div className="empty-state"><b>No history yet.</b><span>Log your first real workout and the graph appears here.</span></div>
      ) : (
        <>
          <select className="history-select" value={activeKey} onChange={(event) => setSelectedKey(event.target.value)}>
            {exerciseOptions.map((exercise) => <option key={exercise.key} value={exercise.key}>{exercise.name}</option>)}
          </select>
          <article className="chart-card">
            <div className="chart-summary">
              <span>Peak load / kg</span>
              <strong>{Math.max(0, ...logs.map((log) => log.weightKg))}</strong>
            </div>
            <div className="chart-sub">
              {points.length > 1 ? (
                <>
                  <b>{(() => {
                    const gain = Math.max(...points.map((p) => p.value)) - points[0].value
                    return `${gain > 0 ? '+' : ''}${Math.round(gain * 100) / 100}`
                  })()}</b>
                  {` SINCE ${points[0].label.toUpperCase()} / ${points.length} SESSIONS`}
                </>
              ) : (
                'FIRST ENTRY / LOG THIS AGAIN TO COMPARE'
              )}
            </div>
            <Sparkline values={points.map((point) => point.value)} />
            <div className="chart-axis"><span>{points[0]?.label ?? '—'}</span><span>{points.at(-1)?.label ?? '—'}</span></div>
          </article>

          <div className="history-list">
            {points.slice().reverse().slice(0, 8).map((point) => (
              <div key={point.iso}><span>{point.label}</span><strong>{point.value} kg</strong><small>{point.sets} completed sets</small></div>
            ))}
          </div>
        </>
      )}

      <ExportPanel logs={snapshot.logs} />
    </div>
  )
}

const RANGES: Array<{ days: ExportRange; label: string }> = [
  { days: 7, label: '7D' },
  { days: 28, label: '28D' },
  { days: 90, label: '90D' },
  { days: 0, label: 'ALL' },
]

// Paste-into-an-AI export. Two things make this practical: the format writes the
// date once per session and the exercise once per exercise (60 chars a set -> ~10),
// and picking a few lifts is the biggest lever there is — one lift over 28 days is
// under 200 characters.
function ExportPanel({ logs }: { logs: SetLog[] }) {
  const [days, setDays] = useState<ExportRange>(28)
  const [picked, setPicked] = useState<string[] | null>(null) // null = every lift
  const [picking, setPicking] = useState(false)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => { if (copiedTimer.current) window.clearTimeout(copiedTimer.current) }, [])

  const available = useMemo(() => loggedExercises(withinRange(logs, days)), [logs, days])
  const result = useMemo(() => buildExport(logs, { days, exerciseKeys: picked }), [logs, days, picked])

  // A lift you picked can vanish when you shorten the range; drop it rather than
  // silently exporting nothing.
  const validPicked = picked?.filter((key) => available.some((e) => e.key === key)) ?? null

  async function copy() {
    await navigator.clipboard.writeText(result.text)
    setCopied(true)
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1800)
  }

  function toggle(key: string) {
    setPicked((current) => {
      const next = current ? [...current] : []
      const at = next.indexOf(key)
      if (at >= 0) next.splice(at, 1)
      else next.push(key)
      return next.length ? next : null
    })
  }

  const status = (() => {
    if (result.chars === 0) return 'Nothing logged in this window.'
    if (result.overBudget) return `${result.chars.toLocaleString()} characters — still too long. Pick fewer lifts or a shorter range.`
    if (result.switched) return `Too long as a full log, so this is a per-lift summary — ${result.chars.toLocaleString()} characters.`
    return `${result.chars.toLocaleString()} characters · ${result.sets} sets · ${result.sessions} sessions`
  })()

  return (
    <div className="export-card">
      <span className="micro-label">COPY FOR AI</span>

      <div className="export-ranges">
        {RANGES.map((range) => (
          <button
            key={range.label}
            className={days === range.days ? 'on' : ''}
            onClick={() => setDays(range.days)}
          >
            {range.label}
          </button>
        ))}
      </div>

      <button className="export-pick" onClick={() => setPicking((v) => !v)}>
        <span>{validPicked ? `${validPicked.length} of ${available.length} lifts` : `All ${available.length} lifts`}</span>
        <b>{picking ? '−' : '+'}</b>
      </button>

      {picking && (
        <div className="export-list">
          <button className={!validPicked ? 'on' : ''} onClick={() => setPicked(null)}>
            <span>Every lift</span><b>{available.length}</b>
          </button>
          {available.map((exercise) => (
            <button
              key={exercise.key}
              className={validPicked?.includes(exercise.key) ? 'on' : ''}
              onClick={() => toggle(exercise.key)}
            >
              <span>{exercise.name}</span><b>{exercise.sets}</b>
            </button>
          ))}
        </div>
      )}

      <p className={`export-status ${result.overBudget ? 'over' : ''}`}>{status}</p>

      <button className="primary-button" disabled={result.chars === 0} onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>

      <p className="export-why">
        Kept under {SAFE_CHARS.toLocaleString()} characters on purpose. Past about 10,000 a chat box
        turns your paste into a file attachment and only skims it — you still get an answer, it just
        quietly is not reading everything.
      </p>
    </div>
  )
}

function historyPoints(logs: AppSnapshot['logs']): Array<{ iso: string; label: string; value: number; sets: number }> {
  const byDate = new Map<string, AppSnapshot['logs']>()
  for (const log of logs) {
    const date = log.workoutDate
    byDate.set(date, [...(byDate.get(date) ?? []), log])
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, dayLogs]) => ({
      iso,
      label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${iso}T12:00:00`)),
      value: Math.max(...dayLogs.map((log) => log.weightKg)),
      sets: dayLogs.length,
    }))
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return <div className="chart-empty">Complete sets to create a graph.</div>
  const width = 340
  const height = 178 // taller than the old 150 so the line has room to show slope
  const left = 36
  const right = width - 12
  const top = 16
  const bottom = height - 20
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.18, 2)
  const yMin = min - pad
  const yMax = max + pad
  const x = (index: number) => left + 8 + (index / Math.max(values.length - 1, 1)) * (right - left - 12)
  const y = (value: number) => bottom - ((value - yMin) / (yMax - yMin)) * (bottom - top)
  const tickStep = (yMax - yMin) / 3
  const ticks = [yMin + tickStep * 0.5, yMin + tickStep * 1.5, yMin + tickStep * 2.5].map((tick) => Math.round(tick / 2.5) * 2.5)
  const uniqueTicks = [...new Set(ticks)].filter((tick) => tick >= yMin && tick <= yMax)
  const path = values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ')
  const last = values.length - 1
  const mono = { fontFamily: 'var(--font-mono), ui-monospace, monospace' }
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Weight history chart">
      {uniqueTicks.map((tick) => (
        <g key={tick}>
          <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth=".6" />
          <text x={left - 5} y={y(tick) + 2.5} textAnchor="end" fontSize="7.5" fill="var(--muted)" style={mono}>{tick}</text>
        </g>
      ))}
      {/* The set-point: a dotted rule drawn across the all-time peak, the way a
          target is marked on a panel. */}
      <line x1={left} x2={right} y1={y(max)} y2={y(max)} stroke="var(--ink)" strokeWidth=".8" strokeDasharray="2 3" opacity=".75" />
      {/* Below the rule, not above it: when the newest session IS the peak —
          the normal case for a lift that is progressing — the value label sits
          above that same point and the two printed on top of each other. */}
      <text x={right} y={y(max) + 9} textAnchor="end" fontSize="7" fill="var(--muted)" letterSpacing="1" style={mono}>PEAK</text>
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((value, index) => (
        <circle key={index} cx={x(index)} cy={y(value)} r={index === last ? 3 : 1.6} fill="var(--ink)" />
      ))}
      <text x={x(last) - 6} y={y(values[last]) - 9} textAnchor="end" fontSize="10" fill="var(--ink)" style={mono}>{values[last]}</text>
    </svg>
  )
}

function CustomExerciseModal({ onClose, onCreate }: { onClose: () => void; onCreate: (input: NewCustomExercise) => void }) {
  const modalRef = useModalFocus(onClose)
  const [name, setName] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('other')
  const [image, setImage] = useState<File | null>(null)
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="custom-title">
        <header><div><span className="micro-label">CUSTOM</span><h2 id="custom-title">New exercise</h2></div><button className="remove-button" onClick={onClose}>×</button></header>
        <label className="photo-picker">
          {preview ? (
            // Blob URLs and private signed URLs are intentionally rendered without image optimization.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="New exercise preview" />
          ) : <><b>＋</b><span>Take or choose a photo</span></>}
          <input type="file" accept="image/*" capture="environment" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
        </label>
        <label>Exercise name<input maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Plate-loaded row" autoFocus /></label>
        <label>Muscle group<select value={muscleGroup} onChange={(event) => setMuscleGroup(event.target.value)}><option>push</option><option>pull</option><option>legs</option><option>core</option><option>other</option></select></label>
        <button className="primary-button" disabled={!name.trim()} onClick={() => onCreate({ name, muscleGroup, image })}>Create</button>
      </section>
    </div>
  )
}

function ExerciseThumb({ exercise }: { exercise: Pick<ExerciseOption, 'name' | 'imageUrl'> }) {
  return exercise.imageUrl ? (
    // Exercise images can be local assets, data URLs, or expiring private signed URLs.
    // 850x567 reference photos rendered into a 30px box — lazy + async decode,
    // because expanding the full library pulled ~3.2 MB of JPEG in one burst.
    // eslint-disable-next-line @next/next/no-img-element
    <img className="exercise-thumb" src={exercise.imageUrl} alt="" width={30} height={30} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none' }} />
  ) : <div className="exercise-thumb fallback">{exercise.name.slice(0, 1)}</div>
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  // inputMode matches the Log screen's set inputs: the 10-key pad, not the
  // cramped numeric plane of the full keyboard. Selecting on focus means one tap
  // replaces the prefilled target instead of caret-placing and backspacing.
  return (
    <label className="number-field">
      <input
        type="number"
        inputMode={Number.isInteger(step) ? 'numeric' : 'decimal'}
        min={min}
        max={max}
        step={step}
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <small>{label}</small>
    </label>
  )
}

// This set against the same set last session. Brightness is the only signal —
// ink for an increase, grey for flat, down, or no prior. Never a colour, never
// a badge, never a celebration.
function SetDelta({ now, before }: { now: number; before?: number }) {
  // `now` starts as the plan target, which is 0 until you set one. Comparing an
  // untouched 0 against a real lift invented a large loss on every row the
  // moment the screen opened, so nothing is claimed until there is a weight.
  if (before === undefined || now <= 0) return <span className="set-delta">—</span>
  const diff = Math.round((now - before) * 100) / 100
  if (diff === 0) return <span className="set-delta" title={`Same as last time (${before} kg)`}>0</span>
  return (
    <span className={`set-delta ${diff > 0 ? 'up' : ''}`} title={`Last time ${before} kg`}>
      {diff > 0 ? '+' : '−'}{Math.abs(diff)}
    </span>
  )
}

// No glyph: three ruled cells, the active one marked by a rule along its top
// edge rather than a colour swap.
function NavButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={active ? 'active' : ''} onClick={onClick}><span>{label}</span></button>
}
