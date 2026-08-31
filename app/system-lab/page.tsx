'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import './system-lab.css'

type Status = 'live' | 'part' | 'plan'

const STATUS_LABEL: Record<Status, string> = { live: 'LIVE', part: 'PARTIAL', plan: 'PLANNED' }

const WL_TABLES = ['wl_workout_days', 'wl_day_exercises', 'wl_sessions', 'wl_set_logs', 'wl_custom_exercises'] as const

interface Counts {
  source: 'cloud' | 'local' | 'none'
  rows: Partial<Record<string, number>>
}

function Node({
  id, name, status, desc, meta, hub, children,
}: {
  id: string; name: string; status: Status; desc: string; meta?: string; hub?: boolean; children?: React.ReactNode
}) {
  return (
    <div className={`sysnode ${hub ? 'hub' : ''} ${status === 'plan' ? 'is-plan' : ''}`} data-node={id}>
      <div className="sysnode-top">
        <strong>{name}</strong>
        <span className={`sysnode-status ${status}`}>{STATUS_LABEL[status]}</span>
      </div>
      <p>{desc}</p>
      {meta && <span className="sysnode-meta">{meta}</span>}
      {children}
    </div>
  )
}

type Wire = 'live' | 'plan' | 'loop'

// [from-node, to-node, kind]. 'loop' is the return path: data that came out of
// the database going straight back into the screen you type on.
const WIRES: Array<[string, string, Wire]> = [
  ['in-app', 'hub', 'live'],
  ['in-library', 'hub', 'live'],
  ['in-whoop', 'hub', 'plan'],
  ['in-goals', 'hub', 'plan'],
  ['hub', 'out-interface', 'live'],
  ['hub', 'out-progress', 'live'],
  ['hub', 'out-copy', 'live'],
  ['hub', 'out-mcp', 'plan'],
  ['hub', 'out-discord', 'plan'],
  ['out-progress', 'in-app', 'loop'],
]

const PROJECT_REF = 'vvfaucmwwrwntwaopyaw'
const DB = `https://supabase.com/dashboard/project/${PROJECT_REF}`

const TABLE_PURPOSE: Record<string, string> = {
  wl_workout_days: 'Your days: Push, Pull, Legs.',
  wl_day_exercises: 'The lifts in each day, with target sets/reps/kg.',
  wl_sessions: 'One row each time you finish a workout.',
  wl_set_logs: 'One row per set you actually did. This is the real data.',
  wl_custom_exercises: 'Machines you added yourself.',
}

const LINKS: Array<{ label: string; href: string; note: string }> = [
  { label: 'Table editor', href: `${DB}/editor`, note: 'See and edit every row.' },
  { label: 'Users', href: `${DB}/auth/users`, note: 'Your login email lives here. Reset a password from the ⋮ menu.' },
  { label: 'Email sign-in settings', href: `${DB}/auth/providers`, note: 'Signups are OFF. Turn them on here.' },
  { label: 'SQL editor', href: `${DB}/sql/new`, note: 'Run queries by hand.' },
  { label: 'Policies (RLS)', href: `${DB}/auth/policies`, note: 'The rules that stop anyone reading your rows.' },
  { label: 'Storage', href: `${DB}/storage/buckets`, note: 'Private buckets. Exercise photos would go here.' },
  { label: 'Logs', href: `${DB}/logs/explorer`, note: 'What went wrong, when.' },
  { label: 'API keys', href: `${DB}/settings/api`, note: 'The two values the app needs. Never share the service key.' },
  { label: 'Vercel project', href: 'https://vercel.com/ohwiseys-projects/workout-logger', note: 'Deploys and the same two env vars.' },
  { label: 'Live app', href: 'https://workout-logger-flame.vercel.app', note: 'The bookmark. Stable across redeploys.' },
  { label: 'GitHub repo', href: 'https://github.com/ohwisey/workout-logger', note: 'The code. Private.' },
]

function DatabasePanel({ counts, onClose }: { counts: Counts; onClose: () => void }) {
  return (
    <div className="sysdb-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="sysdb" role="dialog" aria-modal="true" aria-labelledby="sysdb-title">
        <header>
          <div>
            <span className="sysdb-micro">DATABASE</span>
            <h2 id="sysdb-title">Supabase &ldquo;DB-DB&rdquo;</h2>
          </div>
          <button onClick={onClose} aria-label="Close">×</button>
        </header>

        <p className="sysdb-line">
          Postgres 17 in Paris. Holds every workout you save. The app talks to it with a
          public key that can only ever read your own rows.
        </p>

        <div className="sysdb-facts">
          <div><span>PROJECT</span><b>DB-DB</b></div>
          <div><span>REF</span><b>{PROJECT_REF}</b></div>
          <div><span>REGION</span><b>eu-west-3 · Paris</b></div>
          <div><span>SIZE</span><b>17 MB of 500 MB</b></div>
          <div><span>LOCAL + LIVE</span><b>same database</b></div>
          <div><span>SIGNUPS</span><b>off</b></div>
        </div>

        <h3>The 5 tables that are yours</h3>
        <p className="sysdb-note">
          {counts.source === 'cloud'
            ? 'Counts below are live from Supabase.'
            : counts.source === 'local'
              ? 'Counts below are from THIS BROWSER only — you are not signed in, so nothing here is in Supabase yet.'
              : 'No data loaded. Sign in for cloud counts, or use local mode.'}
        </p>
        <div className="sysdb-tables">
          {WL_TABLES.map((t) => (
            <div key={t}>
              <code>{t}</code>
              <b className={!counts.rows[t] ? 'zero' : ''}>{counts.rows[t] ?? '—'}</b>
              <span>{TABLE_PURPOSE[t]}</span>
            </div>
          ))}
        </div>
        <p className="sysdb-note">
          Every row is stamped with who made it and when. Nothing is ever overwritten —
          that is what makes the history and the graph possible.
        </p>

        <h3>Waiting to be applied</h3>
        <p className="sysdb-line">
          One migration is written but <b>not run</b>:
          <code> 20260830000005_…timing_activities_and_cycle.sql</code>. It adds session and rest
          timers, cardio / sauna / tanning as their own kind of entry, rest days inside the
          Push–Pull–Legs rotation, and two new tables — <code>wl_user_settings</code> and
          <code> wl_activity_logs</code>. It is additive only, and it has been reviewed and
          corrected. Nothing in the app uses it yet, so applying it changes nothing until the
          client catches up.
        </p>

        <h3>Shared with your other apps</h3>
        <p className="sysdb-line">
          This project also holds <b>jarvis</b>, <b>physiquemaxx</b>, <b>dashboards</b> and
          <b> progress photos</b> — 14 other tables. They cannot collide with yours because every
          workout table starts with <code>wl_</code>. Two rules follow: never run a delete-or-rename
          migration here, and do not show the table list on camera.
        </p>

        <h3>Everywhere that matters</h3>
        <div className="sysdb-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer">
              <b>{l.label} ↗</b>
              <span>{l.note}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function SystemLabPage() {
  const [counts, setCounts] = useState<Counts>({ source: 'none', rows: {} })
  const [showDb, setShowDb] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const [paths, setPaths] = useState<Array<{ d: string; kind: Wire }>>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const client = getSupabaseBrowserClient()
      if (client) {
        const { data } = await client.auth.getSession()
        if (data.session?.user) {
          const rows: Counts['rows'] = {}
          await Promise.all(
            WL_TABLES.map(async (table) => {
              const { count } = await client.from(table).select('*', { count: 'exact', head: true })
              rows[table] = count ?? 0
            }),
          )
          if (!cancelled) setCounts({ source: 'cloud', rows })
          return
        }
      }
      try {
        const raw = window.localStorage.getItem('workout-logger:v1')
        if (raw) {
          const snap = JSON.parse(raw)
          if (!cancelled) {
            setCounts({
              source: 'local',
              rows: {
                wl_workout_days: snap.days?.length ?? 0,
                wl_day_exercises: snap.days?.reduce((n: number, d: { exercises?: unknown[] }) => n + (d.exercises?.length ?? 0), 0) ?? 0,
                wl_sessions: new Set((snap.logs ?? []).map((l: { sessionId: string }) => l.sessionId)).size,
                wl_set_logs: snap.logs?.length ?? 0,
                wl_custom_exercises: snap.customExercises?.length ?? 0,
              },
            })
          }
          return
        }
      } catch { /* storage unavailable — leave counts empty */ }
      if (!cancelled) setCounts({ source: 'none', rows: {} })
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    function draw() {
      const grid = gridRef.current
      if (!grid) return
      const gRect = grid.getBoundingClientRect()
      const next: Array<{ d: string; kind: Wire }> = []
      for (const [from, to, kind] of WIRES) {
        const a = grid.querySelector<HTMLElement>(`[data-node="${from}"]`)
        const b = grid.querySelector<HTMLElement>(`[data-node="${to}"]`)
        if (!a || !b) continue
        const ra = a.getBoundingClientRect()
        const rb = b.getBoundingClientRect()

        if (kind === 'loop') {
          // Runs down, along the floor of the map and back up — the wires sit
          // behind the panels, so it reads as cabling rather than a crossing.
          const x1 = ra.left + ra.width / 2 - gRect.left
          const y1 = ra.bottom - gRect.top
          const x2 = rb.left + rb.width / 2 - gRect.left
          const y2 = rb.bottom - gRect.top
          const floor = gRect.height - 26
          next.push({ d: `M ${x1} ${y1} C ${x1} ${floor}, ${x2} ${floor}, ${x2} ${y2}`, kind })
          continue
        }

        const x1 = ra.right - gRect.left
        const y1 = ra.top + ra.height / 2 - gRect.top
        const x2 = rb.left - gRect.left
        const y2 = rb.top + rb.height / 2 - gRect.top
        const mid = (x1 + x2) / 2
        next.push({ d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`, kind })
      }
      setPaths(next)
    }
    draw()
    const observer = new ResizeObserver(draw)
    if (gridRef.current) observer.observe(gridRef.current)
    window.addEventListener('resize', draw)
    return () => { observer.disconnect(); window.removeEventListener('resize', draw) }
  }, [counts])

  const dataLabel = counts.source === 'cloud' ? 'ROW COUNTS · LIVE' : counts.source === 'local' ? 'ROW COUNTS · LOCAL BROWSER' : 'ROW COUNTS · NO DATA'

  return (
    <div className="syslab">
      <div className="syslab-head"><h1>The System</h1></div>
      <p className="syslab-sub">INPUT → DATABASE → OUTPUT</p>

      <div className="syslab-legend">
        <span className="live"><i />LIVE</span>
        <span className="loop"><i />RETURNS TO INPUT</span>
        <span className="plan"><i />PLANNED</span>
      </div>

      <div className="syslab-map">
        <div className="syslab-grid" ref={gridRef}>
          <svg className="syslab-wires" aria-hidden="true">
            {paths.map((p, i) => <path key={i} d={p.d} className={`w-${p.kind}`} />)}
          </svg>

          <div className="syslab-col">
            <h2>INPUTS</h2>
            <Node id="in-app" name="Workout app" status="live"
              desc="Writes sets, reps, weight."
              meta="workout-logger-flame.vercel.app" />
            <Node id="in-library" name="Exercise library" status="live"
              desc="57 lifts, 114 form photos, one cue each. Ships inside the repo — only the name and key are ever written to the database."
              meta="lib/exercise-library.ts" />
            <Node id="in-whoop" name="WHOOP API" status="plan"
              desc="Writes sleep, recovery, strain." />
            <Node id="in-goals" name="Goals" status="plan"
              desc="Writes targets." />
          </div>

          <div className="syslab-col">
            <h2>DATABASE</h2>
            <button className="sysnode-open" onClick={() => setShowDb(true)}>
              Open database →
            </button>
            <Node id="hub" name="Supabase (lifedata)" status="live"
              desc="Postgres. Auth. RLS. Timestamped rows."
              meta={dataLabel}>
              {WL_TABLES.map((table) => {
                const n = counts.rows[table]
                return (
                  <div className="systable" key={table}>
                    <span>{table}</span>
                    <b className={!n ? 'zero' : ''}>{n ?? '—'}</b>
                  </div>
                )
              })}
            </Node>
          </div>

          <div className="syslab-col">
            <h2>OUTPUTS</h2>
            <Node id="out-interface" name="Interface" status="live"
              desc="Reads plan, history, graph." />
            <Node id="out-progress" name="Progress vs last time" status="live"
              desc="Reads wl_set_logs and hands it back to the Log screen — the delta beside every set, the peak readout in History."
              meta="THE LOOP CLOSES HERE" />
            <Node id="out-copy" name="Copy / export" status="live"
              desc="Reads history to clipboard. 1D / 1W / 1M / ALL." />
            <Node id="out-mcp" name="MCP → Claude, ChatGPT" status="plan"
              desc="AI reads the database." />
            <Node id="out-discord" name="Discord" status="plan"
              desc="Sends notifications." />
          </div>
        </div>
      </div>

      <div className="syslab-note">
        <p>
          <b>Read it left to right.</b> You type into one thing. It all lands in one database.
          Everything else is a reader. Nothing on the right owns any data — delete any output and
          the record survives, which is the whole reason it is built this way.
        </p>
        <p>
          <b>Two inputs, only one of them stored.</b> The app writes what you actually did. The
          exercise library — the 57 lifts, the form photos, the cue you get when you tap a picture —
          ships inside the repo and is never written to the database. Only the key and the name go
          in. That is why swapping a photo costs nothing and never touches your history.
        </p>
        <p>
          <b>The dashed line is the point.</b> Everything else runs one way. That one returns:
          your saved sets come back out of the database and land beside the set you are typing right
          now, as <code>+2.5</code> or <code>—</code>. That is the difference between a logbook and
          a system — the output is wired back into the input, so the record changes what you do next.
        </p>
      </div>

      {showDb && <DatabasePanel counts={counts} onClose={() => setShowDb(false)} />}

      <div className="syslab-links">
        <Link href="/">← the app</Link>
        <Link href="/design-lab">design lab</Link>
      </div>
    </div>
  )
}
