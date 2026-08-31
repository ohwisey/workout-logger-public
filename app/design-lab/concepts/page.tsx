import type { CSSProperties } from 'react'
import { Inter, Inter_Tight, IBM_Plex_Mono, Geist_Mono } from 'next/font/google'
import './concepts.css'

const inter = Inter({ subsets: ['latin'] })
const interTight = Inter_Tight({ weight: ['600'], subsets: ['latin'] })
const plex = IBM_Plex_Mono({ weight: ['400', '500', '600'], subsets: ['latin'] })
const geistMono = Geist_Mono({ weight: ['400', '500'], subsets: ['latin'] })

const INTER = `${inter.style.fontFamily}, ui-sans-serif, system-ui, sans-serif`
const TIGHT = `${interTight.style.fontFamily}, ${inter.style.fontFamily}, sans-serif`
const PLEX = `${plex.style.fontFamily}, ui-monospace, Menlo, monospace`
const GEIST = `${geistMono.style.fontFamily}, ui-monospace, Menlo, monospace`

// Eight weeks of kept days, oldest first. The pattern deliberately gets denser
// left-to-right so the ribbon reads as a habit forming rather than as noise.
const KEPT = (
  '1001000' + '1010010' + '1101010' + '1101010' +
  '1110110' + '1101110' + '1111010' + '111101'
).split('')

function Daybook() {
  const style = {
    '--paper': '#0B0B0A', '--ink': '#EFEAE2', '--muted': '#8A847B',
    '--divider': '#1F1E1C', '--field': '#4A4740', '--on-accent': '#0B0B0A',
    '--body': INTER, '--mono': GEIST, '--display': INTER,
  } as CSSProperties

  return (
    <div className="cx-phone" style={style}>
      <div className="cx-screen">
        <div className="db-top">
          <span className="db-date">SAT 30 AUG</span>
          <span className="db-dots">···</span>
        </div>
        <div className="db-job">Push · 6 lifts · 22 sets</div>
        <div className="db-hr" />

        <div className="db-ribbon">
          {KEPT.map((d, i) => (
            <i key={i} className={`db-tick ${d === '1' ? 'on' : ''}`} />
          ))}
          <i className="db-tick today" />
        </div>
        <div className="db-foot">LAST PUSH · 22 OF 22 SETS · 4 DAYS AGO</div>
        <div className="db-hr" />

        <div className="db-entry">
          <strong>Barbell bench</strong>
          <span className="db-sets">
            <i>01 &nbsp;80 × 5</i><i>02 &nbsp;80 × 5</i><i>03 &nbsp;82.5 × 4</i>
          </span>
        </div>

        <div className="db-live">
          <div className="db-live-name">Incline DB press</div>
          <div className="db-fields">
            <div className="db-f"><b>30</b><small>KG</small></div>
            <div className="db-f"><b>10</b><small>REPS</small></div>
            <div className="db-circle" />
          </div>
        </div>

        <div className="db-entry" style={{ opacity: 0.45 }}>
          <strong>Standing barbell OHP</strong>
          <span>not started</span>
        </div>

        {/* every screen closes like a page closes */}
        <div className="db-colophon">
          <div className="db-hr" />
          DAYBOOK · 41 DAYS KEPT · CLOUD
        </div>
      </div>
      <div className="cx-nav">
        <div className="on">PLAN</div><div>LOG</div><div>HISTORY</div>
      </div>
    </div>
  )
}

function Since() {
  const style = {
    '--paper': '#0B0B0B', '--ink': '#F4F1EC', '--muted': '#8C8781',
    '--divider': '#1E1D1B', '--field': '#4A4844', '--accent': '#D9A15B',
    '--on-accent': '#0B0B0B', '--body': INTER, '--mono': PLEX, '--display': TIGHT,
  } as CSSProperties

  return (
    <div className="cx-phone" style={style}>
      <div className="cx-screen">
        <span className="sn-label">EVIDENCE</span>
        <div className="sn-ex">Barbell bench</div>

        <div className="sn-fig">
          <i className="sn-gut-now" />
          <div>
            <div className="sn-cap">NOW</div>
            <div className="sn-now">82.5<span className="sn-unit">kg</span></div>
          </div>
        </div>
        <div className="sn-fig" style={{ marginTop: 12 }}>
          <i className="sn-gut-then" />
          <div>
            <div className="sn-cap">12 JUL</div>
            <div className="sn-then">60.0<span className="sn-unit">kg</span></div>
          </div>
        </div>

        <p className="sn-sent"><b>+22.5 kg since 12 July</b> · 14 weeks · 26 sessions</p>

        <div className="sn-strip">
          <svg viewBox="0 0 300 28" style={{ width: '100%', height: 28, display: 'block' }} aria-hidden="true">
            <polyline
              points="4,22 48,20 92,17 136,14 180,12 224,8 268,5 296,3"
              fill="none" stroke="var(--ink)" strokeOpacity=".4" strokeWidth="1"
            />
            <circle cx="4" cy="22" r="2.5" fill="var(--muted)" />
            <circle cx="296" cy="3" r="3" fill="var(--accent)" />
          </svg>
          <div className="sn-ends"><span>12 JUL</span><span>NOW</span></div>
        </div>

        <div className="sn-hr" />
        {[
          ['30 AUG', '82.5', '+2.5', true],
          ['26 AUG', '80.0', '+2.5', true],
          ['21 AUG', '77.5', '—', false],
          ['17 AUG', '77.5', '+5.0', true],
        ].map(([d, w, x, up]) => (
          <div className="sn-row" key={String(d)}>
            <i className={`sn-mark ${up ? 'up' : ''}`} />
            <span className="d">{d}</span>
            <span className="w">{w}</span>
            <span className={`x ${up ? 'up' : ''}`}>{x}</span>
          </div>
        ))}

        {/* one control, two jobs: it sets what "then" means AND what gets copied */}
        <div className="sn-range">
          <span>1W</span><span>1M</span><span className="on">3M</span><span>ALL</span>
        </div>
      </div>
      <div className="cx-nav">
        <div>PLAN</div><div>LOG</div><div className="on">HISTORY</div>
      </div>
    </div>
  )
}

function SinceLog() {
  const style = {
    '--paper': '#0B0B0B', '--ink': '#F4F1EC', '--muted': '#8C8781',
    '--divider': '#1E1D1B', '--field': '#4A4844', '--accent': '#D9A15B',
    '--on-accent': '#0B0B0B', '--body': INTER, '--mono': PLEX, '--display': TIGHT,
  } as CSSProperties

  return (
    <div className="cx-phone" style={{ ...style, height: 380 }}>
      <div className="cx-screen">
        <span className="sn-label">THE PAST, INSIDE THE PRESENT</span>
        <div className="sn-ex" style={{ fontSize: 18 }}>Barbell bench</div>
        <div style={{ fontFamily: PLEX, fontSize: 10, color: 'var(--muted)', letterSpacing: '.1em', marginTop: 8 }}>
          SET 3/4 · HEAVIEST TODAY 82.5 · LAST TIME 77.5
        </div>
        <div style={{ height: 12 }} />
        {[
          ['01', '80.0', '5', '77.5×5', true],
          ['02', '80.0', '5', '77.5×5', true],
          ['03', '82.5', '4', '77.5×4', false],
        ].map(([i, kg, reps, ghost, done]) => (
          <div className="sn-set" key={String(i)}>
            <span className="i">{i}</span>
            <span className="f">{kg}<small>KG</small></span>
            <span className="f">{reps}<small>REPS</small></span>
            <span className="sn-ghost">{ghost}</span>
            <i className={`sn-tick ${done ? 'on' : ''}`} />
          </div>
        ))}
      </div>
      <div className="cx-nav"><div>PLAN</div><div className="on">LOG</div><div>HISTORY</div></div>
    </div>
  )
}

function Caliper() {
  const style = {
    '--paper': '#08090B', '--ink': '#F4F5F7', '--muted': '#7E858F',
    '--divider': '#191C21', '--field': '#3A3D42', '--lamp-off': '#3A3D42',
    '--accent': '#E8B14C', '--on-accent': '#0B0C0E',
    '--body': INTER, '--mono': PLEX, '--display': PLEX,
  } as CSSProperties

  return (
    <div className="cx-phone square" style={style}>
      <div className="cx-screen">
        <div className="cl-strip">
          <div>SETS 12/18</div><div>VOL 4,280</div><div>LAST 12 AUG</div>
        </div>
        <div style={{ height: 16 }} />
        <span className="cl-legend">PEAK LOAD / KG</span>
        <div className="cl-read">102.5</div>
        <div className="cl-sub"><b>+12.5</b> SINCE 14 JUN / 9 SESSIONS</div>

        <svg viewBox="0 0 300 120" style={{ width: '100%', height: 108, display: 'block', marginTop: 12 }} aria-hidden="true">
          {[26, 56, 86].map((y) => (
            <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="var(--divider)" strokeWidth="1" />
          ))}
          <line x1="0" x2="300" y1="16" y2="16" stroke="var(--accent)" strokeWidth="1" strokeDasharray="2 3" />
          <text x="298" y="12" textAnchor="end" fontSize="7" fill="var(--accent)" fontFamily={PLEX} letterSpacing="1">PEAK</text>
          <polyline
            points="6,96 48,88 90,74 132,66 174,48 216,40 258,26 292,16"
            fill="none" stroke="var(--ink)" strokeWidth="1" strokeLinejoin="round"
          />
          {[[6, 96], [48, 88], [90, 74], [132, 66], [174, 48], [216, 40], [258, 26]].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="1.6" fill="var(--ink)" />
          ))}
          <circle cx="292" cy="16" r="3" fill="var(--accent)" />
        </svg>

        <div className="cl-hr" />
        {[
          ['01', '80.0', '5', '+2.5', true],
          ['02', '80.0', '5', '—', true],
          ['03', '82.5', '4', '+5.0', false],
        ].map(([i, kg, reps, delta, lit]) => (
          <div className="cl-set" key={String(i)}>
            <span className="i">{i}</span>
            <span className="v">{kg}<small>KG</small></span>
            <span className="v">{reps}<small>REP</small></span>
            <span className={`cl-delta ${delta !== '—' ? 'up' : ''}`}>{delta}</span>
            <i className={`cl-lamp ${lit ? 'on' : ''}`} />
          </div>
        ))}
      </div>
      <div className="cx-nav"><div>PLAN</div><div className="on">LOG</div><div>HISTORY</div></div>
    </div>
  )
}

export default function ConceptsPage() {
  return (
    <div className="cx" style={{ '--cx-ui': INTER } as CSSProperties}>
      <div className="cx-head">
        <h1>Three directions</h1>
        <p>
          Five designers worked the same brief from different angles; three judges — you, someone in
          your audience, and a product designer — scored every one. These are the top three.
          All monochrome-first, all minimal, all built from hairlines and type. <b>No green, no Anton,
          no serif.</b>
        </p>
        <p>
          They differ in <b>what the app shows you first</b>, which is really the only question:
          your consistency, your progress, or your precision.
        </p>
      </div>

      <div className="cx-rule" />

      <div className="cx-grid">
        {/* ---------------- DAYBOOK ---------------- */}
        <div className="cx-col">
          <span className="cx-tag">01 · CONSISTENCY</span>
          <h2 className="cx-name">Daybook</h2>
          <p className="cx-one">
            The app opens as a dated page in a private ledger. Eight weeks of kept days drawn as
            hairline ticks — evidence before navigation.
          </p>
          <span className="cx-score">RANKED 1ST · 130/150</span>
          <Daybook />
          <div className="cx-note">
            <h3>WHY IT WORKS</h3>
            <p>
              The hero is <b>your behaviour, not your numbers</b>. 56 ticks tell you whether you are
              the kind of person who shows up, without one word of praise. It is also the only
              direction that gets the app opened <b>on a rest day</b>.
            </p>
            <p>
              Accent discipline is absolute: <b>the ink is the accent</b>. Numbers go monospace so
              they align like a ledger column; names stay Inter so they disappear.
            </p>
            <h3>THE RISK</h3>
            <p className="risk">
              It sits <b>one bad decision from being a streak widget</b> — add a counter or a flame and
              it becomes the gamification you never asked for. And day one is 55 grey ticks, which
              reads as an accusation. The first week needs designing, not shipping.
            </p>
          </div>
        </div>

        {/* ---------------- SINCE ---------------- */}
        <div className="cx-col">
          <span className="cx-tag">02 · PROGRESS</span>
          <h2 className="cx-name">Since</h2>
          <p className="cx-one">
            Every screen opens with a sentence instead of a chart. What you lift now, stacked
            directly above what you lifted in July.
          </p>
          <span className="cx-score">RANKED 2ND · 128/150</span>
          <Since />
          <div className="cx-note">
            <h3>WHY IT WORKS</h3>
            <p>
              It hands you <b>the one sentence worth saying on camera</b> — &ldquo;82.5 now, 60 in
              July&rdquo; — and gets there by deleting the chart rather than adding to it. Because both
              figures are monospaced, the top number is physically wider and brighter: you
              <b> read the progress before you read the numbers</b>.
            </p>
            <p>
              Amber is the colour of <b>change and nothing else</b> — never a button, never a heading.
              A bad month renders in calm grey, never red.
            </p>
            <h3>THE RISK</h3>
            <p className="risk">
              The idea itself is <b>the most conventional here</b> — every dashboard does
              vs-last-period. It lives or dies on execution. And on day one the hero is an empty state.
            </p>
          </div>
          <SinceLog />
          <div className="cx-note">
            <p>
              Its best move: the <b>ghost column</b>. Last session&rsquo;s set sits inside today&rsquo;s
              input. Proof of change appears while you type, not later in History.
            </p>
          </div>
        </div>

        {/* ---------------- CALIPER ---------------- */}
        <div className="cx-col">
          <span className="cx-tag">03 · PRECISION</span>
          <h2 className="cx-name">Caliper</h2>
          <p className="cx-one">
            Lab equipment rather than an app. Square corners, silkscreen legends, one enormous
            readout per screen, and a peak line drawn across the plot.
          </p>
          <span className="cx-score">RANKED 3RD · 114/150</span>
          <Caliper />
          <div className="cx-note">
            <h3>WHY IT WORKS</h3>
            <p>
              <b>Killing every corner radius</b> does more than any other single change — radius is what
              makes the current build read &ldquo;app&rdquo; instead of &ldquo;instrument&rdquo;. And the
              <b> delta column</b> was judged the strongest engagement idea of all five directions:
              each row simply states whether you beat last time.
            </p>
            <h3>WHAT I CHANGED</h3>
            <p>
              The original lit <b>eighteen amber lamps</b> down the Log screen. All three judges called
              that a colour accent by another name — the gold-premium-fitness look. So the lamps are
              ink and amber survives only on the peak line and a positive delta.
            </p>
            <h3>THE RISK</h3>
            <p className="risk">
              It is the <b>coldest of the three</b>. A tool you respect but might not open at 6am. Its
              rules also erode easily — the day exercise names drift into monospace, it becomes
              terminal cosplay.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
