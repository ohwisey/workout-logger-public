'use client'

import { useState, type CSSProperties } from 'react'
import {
  Anton, Archivo_Black, Bebas_Neue, Big_Shoulders, DM_Serif_Display, EB_Garamond,
  Geist, Geist_Mono, IBM_Plex_Mono, Instrument_Serif, Inter, JetBrains_Mono, Manrope,
  Playfair_Display, Space_Grotesk, Space_Mono,
} from 'next/font/google'
import { THEMES } from './themes'
import './design-lab.css'

const anton = Anton({ weight: '400', subsets: ['latin'] })
const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'] })
const archivoBlack = Archivo_Black({ weight: '400', subsets: ['latin'] })
const bigShoulders = Big_Shoulders({ weight: '700', subsets: ['latin'] })
const spaceGrotesk = Space_Grotesk({ weight: ['500', '700'], subsets: ['latin'] })
const instrumentSerif = Instrument_Serif({ weight: '400', style: 'italic', subsets: ['latin'] })
const playfair = Playfair_Display({ weight: '500', style: 'italic', subsets: ['latin'] })
const dmSerif = DM_Serif_Display({ weight: '400', style: 'italic', subsets: ['latin'] })
const garamond = EB_Garamond({ weight: '500', style: 'italic', subsets: ['latin'] })
const inter = Inter({ subsets: ['latin'] })
const manrope = Manrope({ subsets: ['latin'] })
const geist = Geist({ subsets: ['latin'] })
const plexMono = IBM_Plex_Mono({ weight: ['500', '600'], subsets: ['latin'] })
const jetbrainsMono = JetBrains_Mono({ weight: ['500', '600'], style: ['normal', 'italic'], subsets: ['latin'] })
const spaceMono = Space_Mono({ weight: ['400', '700'], subsets: ['latin'] })
const geistMono = Geist_Mono({ weight: ['500', '600'], subsets: ['latin'] })

interface TypeSet {
  id: string
  name: string
  blurb: string
  display: string
  displayWeight: number
  displayTracking: string
  serif: string
  body: string
  mono: string
}

const TYPESETS: TypeSet[] = [
  {
    id: 'poster',
    name: 'Poster',
    blurb: 'Anton + Instrument Serif — the thumbnail look. Loud condensed caps, one serif moment, mono labels.',
    display: `${anton.style.fontFamily}, 'Arial Narrow', Impact, sans-serif`,
    displayWeight: 400, displayTracking: '.01em',
    serif: `${instrumentSerif.style.fontFamily}, Georgia, serif`,
    body: `${inter.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
    mono: `${plexMono.style.fontFamily}, ui-monospace, Menlo, monospace`,
  },
  {
    id: 'bebas',
    name: 'Bebas',
    blurb: 'Bebas Neue + DM Serif — taller, rounder condensed. Warmer body, wide typewriter mono.',
    display: `${bebas.style.fontFamily}, 'Arial Narrow', Impact, sans-serif`,
    displayWeight: 400, displayTracking: '.02em',
    serif: `${dmSerif.style.fontFamily}, Georgia, serif`,
    body: `${manrope.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
    mono: `${spaceMono.style.fontFamily}, ui-monospace, Menlo, monospace`,
  },
  {
    id: 'editorial',
    name: 'Editorial',
    blurb: 'Big Shoulders + Playfair — magazine condensed with the classic italic. Most refined.',
    display: `${bigShoulders.style.fontFamily}, 'Arial Narrow', Impact, sans-serif`,
    displayWeight: 700, displayTracking: '.015em',
    serif: `${playfair.style.fontFamily}, Georgia, serif`,
    body: `${inter.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
    mono: `${jetbrainsMono.style.fontFamily}, ui-monospace, Menlo, monospace`,
  },
  {
    id: 'swiss',
    name: 'Swiss',
    blurb: 'Archivo Black + Garamond — flat heavy grotesque instead of condensed. Most neutral, least poster.',
    display: `${archivoBlack.style.fontFamily}, Arial, sans-serif`,
    displayWeight: 400, displayTracking: '-.01em',
    serif: `${garamond.style.fontFamily}, Georgia, serif`,
    body: `${inter.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
    mono: `${plexMono.style.fontFamily}, ui-monospace, Menlo, monospace`,
  },
  {
    id: 'terminal',
    name: 'Terminal',
    blurb: 'Space Grotesk + JetBrains italic — no serif, no poster type. Pure instrument.',
    display: `${spaceGrotesk.style.fontFamily}, ui-sans-serif, sans-serif`,
    displayWeight: 700, displayTracking: '-.02em',
    serif: `${jetbrainsMono.style.fontFamily}, ui-monospace, Menlo, monospace`,
    body: `${geist.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`,
    mono: `${geistMono.style.fontFamily}, ui-monospace, Menlo, monospace`,
  },
]

function themeStyle(theme: (typeof THEMES)[number], type: TypeSet): CSSProperties {
  return {
    ...theme.tokens,
    '--font-display': type.display,
    '--display-weight': String(type.displayWeight),
    '--display-tracking': type.displayTracking,
    '--font-serif': type.serif,
    '--font-body': type.body,
    '--font-mono': type.mono,
  } as CSSProperties
}

// Bench series for the chart study: workoutDate -> best weight
const CHART = {
  values: [72.5, 75, 75, 77.5, 80, 82.5],
  labels: ['JUL 4', 'AUG 29'],
  yTicks: [70, 75, 80],
  yMin: 68,
  yMax: 85,
}

function EducatedChart() {
  const w = 300
  const h = 132
  const left = 34
  const right = 288
  const top = 14
  const bottom = 112
  const x = (i: number) => left + 10 + (i / (CHART.values.length - 1)) * (right - left - 14)
  const y = (v: number) => bottom - ((v - CHART.yMin) / (CHART.yMax - CHART.yMin)) * (bottom - top)
  const d = CHART.values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const last = CHART.values.length - 1
  const mono = { fontFamily: 'var(--font-mono)' } as CSSProperties

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Best weight per session">
      {CHART.yTicks.map((tick) => (
        <g key={tick}>
          <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} stroke="var(--line)" strokeWidth=".6" opacity=".55" />
          <text x={left - 5} y={y(tick) + 2.5} textAnchor="end" fontSize="7.5" fill="var(--muted)" style={mono}>{tick}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--mint)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {CHART.values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === last ? 2.8 : 1.8} fill={i === last ? 'var(--mint)' : 'var(--white)'} stroke="var(--mint)" strokeWidth="1.2" />
      ))}
      <text x={x(last) - 4} y={y(CHART.values[last]) - 7} textAnchor="end" fontSize="10" fill="var(--ink)" style={mono}>82.5</text>
    </svg>
  )
}

export default function DesignLabPage() {
  const [active, setActive] = useState(THEMES[0])
  const [typeSet, setTypeSet] = useState(TYPESETS[0])
  const style = themeStyle(active, typeSet)

  return (
    <div className="lab">
      <div className="lab-bar">
        <div>
          <h1>Workout Logger — dark theme lab</h1>
          <p>Nine palettes × five type sets. Pick a combination and it becomes the app.</p>
        </div>
        <div className="lab-pickers">
          <div className="lab-picker">
            <span className="lab-axis">COLOR</span>
            {THEMES.map((theme) => (
              <button key={theme.id} className={theme.id === active.id ? 'on' : ''} onClick={() => setActive(theme)}>
                {theme.name}
              </button>
            ))}
          </div>
          <div className="lab-picker">
            <span className="lab-axis">TYPE</span>
            {TYPESETS.map((set) => (
              <button key={set.id} className={set.id === typeSet.id ? 'on' : ''} onClick={() => setTypeSet(set)}>
                {set.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="lab-blurb"><b>{active.name}.</b> {active.blurb} <b>{typeSet.name}.</b> {typeSet.blurb}</p>

      <div className="lab-grid" style={style}>
        <div className="lab-cell">
          <span className="lab-cap">01 · SIGN IN (ONCE)</span>
          <div className="sk">
            <div className="sk-auth">
              <h2>Workout log</h2>
              <label className="sk-label">Email<input className="sk-input" readOnly placeholder="you@example.com" /></label>
              <label className="sk-label">Password<input className="sk-input" readOnly type="password" placeholder="••••••••" /></label>
              <button className="sk-cta">Sign in</button>
              <button className="sk-ghost">Create account</button>
            </div>
          </div>
        </div>

        <div className="lab-cell">
          <span className="lab-cap">02 · PLAN</span>
          <div className="sk">
            <div className="sk-head">
              <div>
                <em className="sk-greet">Good afternoon, Rowan</em>
                <span className="sk-date">SATURDAY, AUGUST 29</span>
              </div>
              <button className="sk-icon">L</button>
            </div>
            <div className="sk-days">
              <button className="on">Push</button><button>Pull</button><button>Legs</button>
            </div>
            <div className="sk-body">
              {[
                ['Barbell bench', 'PUSH', '4', '5', '80'],
                ['Incline DB press', 'PUSH', '3', '10', '30'],
                ['Standing barbell OHP', 'PUSH', '3', '10', '40'],
              ].map(([name, group, sets, reps, kg]) => (
                <div className="sk-row" key={name}>
                  <div className="sk-row-main"><strong>{name}</strong><span>{group}</span></div>
                  <div className="sk-num"><b>{sets}</b><small>SETS</small></div>
                  <div className="sk-num"><b>{reps}</b><small>REPS</small></div>
                  <div className="sk-num"><b>{kg}</b><small>KG</small></div>
                </div>
              ))}
              <input className="sk-input" readOnly placeholder="Search exercises" />
              <button className="sk-cta">Save day</button>
            </div>
            <div className="sk-nav">
              <div className="on"><b>＋</b>Plan</div><div><b>✓</b>Log</div><div><b>↗</b>History</div>
            </div>
          </div>
        </div>

        <div className="lab-cell">
          <span className="lab-cap">03 · LOG (THE GYM SCREEN)</span>
          <div className="sk">
            <div className="sk-head">
              <div><span className="sk-micro">PUSH</span><strong>Barbell bench</strong></div>
              <span className="sk-stat">5/8 SETS</span>
            </div>
            <div className="sk-body">
              <div className="sk-track"><i /></div>
              {[['01', '80', '5', true], ['02', '80', '5', true], ['03', '82.5', '4', false]].map(([i, kg, reps, done]) => (
                <div className={`sk-set ${done ? 'done' : ''}`} key={String(i)}>
                  <span className="sk-set-i">{i}</span>
                  <span className="sk-pill"><b>{kg}</b><small>KG</small></span>
                  <span className="sk-pill"><b>{reps}</b><small>REPS</small></span>
                  <button className="sk-check">{done ? '✓' : '○'}</button>
                </div>
              ))}
              <button className="sk-cta">Save workout</button>
            </div>
            <div className="sk-nav">
              <div><b>＋</b>Plan</div><div className="on"><b>✓</b>Log</div><div><b>↗</b>History</div>
            </div>
          </div>
        </div>

        <div className="lab-cell">
          <span className="lab-cap">04 · HISTORY + COPY</span>
          <div className="sk">
            <div className="sk-head">
              <div><span className="sk-micro">HISTORY</span><strong>Barbell bench</strong></div>
              <button className="sk-icon">L</button>
            </div>
            <div className="sk-body">
              <div className="sk-chart">
                <div className="sk-chart-top"><span>BEST WEIGHT · KG</span><strong>82.5</strong></div>
                <EducatedChart />
                <div className="sk-axis"><span>{CHART.labels[0]}</span><span>{CHART.labels[1]}</span></div>
              </div>
              <div className="sk-copy-row">
                <span className="sk-micro">COPY</span>
                <div className="sk-copy">
                  <button>1D</button><button>1W</button><button>1M</button><button>ALL</button>
                </div>
              </div>
            </div>
            <div className="sk-nav">
              <div><b>＋</b>Plan</div><div><b>✓</b>Log</div><div className="on"><b>↗</b>History</div>
            </div>
          </div>
        </div>

        <div className="lab-cell">
          <span className="lab-cap">05 · SETTINGS (LOGOUT LIVES HERE)</span>
          <div className="sk">
            <div className="sk-settings">
              <div><span className="sk-micro">ACCOUNT</span><h2 style={{ margin: '4px 0 0', fontSize: 24, letterSpacing: '-.04em' }}>Settings</h2></div>
              <div className="sk-srow"><span>Mode</span><strong>Cloud sync</strong></div>
              <div className="sk-srow"><span>Signed in as</span><strong>you@example.com</strong></div>
              <button className="sk-danger">Log out</button>
            </div>
          </div>
        </div>

        <div className="lab-cell">
          <span className="lab-cap">06 · DESKTOP</span>
          <div className="sk">
            <div className="sk-hero">
              <h2>Workout log.</h2>
              <span>PLAN · LOG · HISTORY</span>
            </div>
          </div>
        </div>
      </div>

      <div className="lab-tokens">
        <h2>{active.name} — the whole change</h2>
        <p>This replaces the <code>:root</code> block in app/globals.css. Nothing else about the app moves.</p>
        <pre>{`:root {\n  color-scheme: dark;\n${Object.entries(active.tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}`}</pre>
      </div>
    </div>
  )
}
