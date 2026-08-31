# Build this from nothing — the prompts

Two prompts, two levels of ownership.

- **Level 1 — one file, ten minutes.** Paste, get one `index.html`, drag it
  into netlify.com/drop. No accounts, no database, no build tools. Your data
  lives in your browser.
- **Level 2 — the real thing.** A proper app with sign-in, your own Postgres
  database, and a deploy that survives. This is what this repo is.

Start with Level 1. It's the same idea — input → storage → output — and you
see it working today. Level 2 is the same app with the storage upgraded from
your browser to a database you own.

---

## Level 1 — the one-file prompt

Paste everything in the block into Claude. You get back ONE file. Save it as
`index.html` and drag it into netlify.com/drop. That's it.

```
Build me a single-file self-tracker as ONE complete index.html — all CSS
and JavaScript inline, no build tools, no frameworks, no external
services. It must work offline, opened as a plain file.

WHAT IT IS: a workout set logger that answers one question — "am I
beating last time?"

FEATURES (exactly these, nothing more):
- Add a set: exercise name, weight, reps. Two taps max.
- Exercise names I've used before appear as quick buttons.
- One chart per exercise: top weight per day, as a simple line — drawn
  with inline SVG, no chart library.
- A line under the chart: "Last time: X kg × Y. Beat it."
- Everything saves in localStorage so it survives closing the app.
- An export button that copies all my data as plain text — my data is
  mine. Write the date once and the exercise once, then the sets, so a
  month still pastes into an AI chat without getting cut off.

DESIGN: dark, calm, big touch targets, phone-first. No emoji clutter, no
gradients everywhere. It should feel like a tool, not a toy.

PHONE RULES (non-negotiable):
- Every input font-size 16px or bigger, or iPhones zoom the page on tap.
- Number fields open the phone's number pad and select their contents on
  focus, so I type over the old value.
- Everything tappable is at least 44x44px.
- No text smaller than 12px anywhere.

RULES:
- If data is missing, show an honest empty state — never invent numbers.
- Keep the code readable: short functions, named clearly.
- Tell me in one sentence how to add it to my phone's home screen when
  you're done.
```

---

## Level 2 — the full ownership prompt

For when Level 1 has you hooked and you want sign-in, a real database, and
history that can't be lost by clearing your browser. Paste this into Claude
Code as your first message in an empty folder.

```
Build me a personal workout logger that I fully own. Work in this empty
folder. I am not a professional developer — explain what you're doing in
plain language as you go, and never assume I know a term.

THE IDEA
One person. One input, one database, one output. I type in what I lifted,
it lands in my own database, and the history comes back out as proof I'm
improving. No accounts for other people, no social features, no AI coaching,
no workout generation, no wearables. If a feature idea isn't input, storage,
or output, leave it out.

THE STACK — do not substitute
- Next.js with the App Router, TypeScript.
- Supabase for sign-in and the database (Postgres with Row Level Security).
- Deployed on Vercel later; must run locally first with `pnpm dev`.
- The app must need exactly TWO environment variables and nothing else:
  NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
- Also build a LOCAL-ONLY mode: if I skip sign-in, everything works the
  same but saves to the browser instead, so I can try it with no setup.

THE THREE SCREENS (phone first — I will use this in the gym, one-handed)
1. PLAN — build named workout days (Push / Pull / Legs to start) from an
   exercise library. Each exercise gets target sets, reps, and kg. I can
   search the library, and add my own custom exercise with a name, muscle
   group, and photo.
2. LOG — today's day as a list of sets. For each set: weight, reps, and a
   big circle I tap when the set is done. Tapping an exercise name shows
   its history. Save writes the whole workout at once.
3. HISTORY — pick an exercise, see the heaviest weight per session as a
   simple line chart and a list. Plus a COPY button that puts my history on
   the clipboard as compact plain text, so I can paste it into an AI chat
   and ask about my training.

THE DATABASE — get this right first
- Tables: workout days, the exercises planned in each day, workout
  sessions, one row per logged set, and custom exercises. Prefix every
  table name (I use wl_) so this can share a database with other projects.
- Every table has a user_id. Row Level Security on everything: a signed-in
  user can only ever see and touch their own rows. Test this.
- Saving a workout must be all-or-nothing (one transaction): the session
  and all its set rows, or neither.
- History is never overwritten. Rows are only ever added. That rule is
  what makes the chart trustworthy.
- Write the schema as SQL migration files in supabase/migrations so I can
  re-run the whole setup on a fresh Supabase project in one step.

THE LOOK — strict, do not decorate
- Dark, monochrome. Near-black background, off-white text, one shade of
  grey for secondary text. WHITE IS THE ONLY ACCENT — nothing is coloured
  to mean "good"; brightness carries meaning. The one exception is a muted
  red for delete/error only.
- Square corners everywhere. Flat rows separated by 1px hairlines — no
  cards, no shadows, no rounded panels.
- Inter for words. A monospace (IBM Plex Mono) for every number and every
  small uppercase label, so numbers line up in columns like an instrument.
- One white full-width action button per screen, docked at the bottom.
- Underline-style inputs (a bottom border only), not boxed fields.

PHONE RULES — these are the difference between usable and not
- No text smaller than 12px anywhere. Exercise names 17px. The numbers I
  type while training: 20px or more.
- Every input at least 16px font-size, or iPhones zoom the page when I tap
  it (17px to be safe).
- Every tappable thing at least 44x44px, 48px for the ones I hit
  mid-workout (the set-done circle, delete buttons, the bottom nav).
- Number inputs must open the phone's number pad (inputMode) and select
  their contents on focus so I type over the old value.
- The save button must never cover list content — give it an opaque
  full-width band docked at the bottom of the scroll area.
- Test at 320px and at 440px wide. Both must work with no sideways scroll.

THE ONE FEATURE THAT MAKES IT A SYSTEM
Next to every set on the Log screen, show how it compares to the same set
the last time I did that exercise: +2.5, 0, or a dash if there's no
history. Grey normally, white when it's an increase. This is the loop —
the output feeding back into the input — and it's the whole reason the
app gets opened.

THE EXPORT — this has a real constraint
Chat apps silently mangle long pastes (ChatGPT converts anything over
~10,000 characters into an attachment it only skims). So the copy format
must be compact: write the date once per session and the exercise name
once per exercise, then the sets as 80x6,6,5 — not one long line per set.
Give me range choices (7 days, 28 days, 90 days, all) and let me pick
which exercises to include. Show the character count. If the result would
top ~5,000 characters, automatically switch to a per-exercise summary and
say so in one line.

TRAPS I KNOW ABOUT — avoid them up front
- crypto.randomUUID() doesn't exist on http:// addresses, and I'll test on
  my phone over wifi. Use a fallback.
- Supabase fires auth events on token refresh; don't let that reload state
  and wipe a workout I'm halfway through logging.
- Only an explicit sign-out should ever log me out — a flaky network
  must not.
- Modals need real focus handling: focus moves in, Escape closes, focus
  returns. aria-modal alone does nothing.

HOW WE'LL WORK
Build it in this order, and stop after each step so I can look at it:
1. The three screens working fully in local-only mode (no Supabase yet).
2. The SQL migrations, and cloud sync behind sign-in.
3. The delta column and the export.
Then run through the whole flow — plan a day, log a workout, save it,
check the chart, copy the export — and fix what's broken before calling
anything done.
```

---

## After Level 2 works — follow-up prompts

One at a time, in this order. Small prompts, one job each.

**Deploy it:**
> Push this to a private GitHub repo, then walk me through deploying it on
> Vercel step by step, including adding my two Supabase environment
> variables. Assume I've never used either site.

**When something looks wrong on your phone:**
> Here's a screenshot from my phone. Fix it, and check every screen at
> 320px and 440px wide while you're at it.

**The balance line (optional):**
> Tag every exercise in the library with its primary muscle (chest,
> shoulders, triceps, back, biceps, quads, hamstrings, glutes, calves,
> core) and its movement pattern (flat press, incline press, overhead
> press, vertical pull, row, squat, hinge, lunge, isolation). On the Plan
> screen, sort the exercise list so the current day's kind comes first.
> Under the plan, show ONE quiet grey line — no popup, no colour: if 3+
> exercises hit one muscle and an expected muscle for that day has none,
> say so ("All chest so far — nothing for shoulders or triceps yet."); if
> every compound movement is the same pattern, say that instead. Fewer
> than 3 exercises, or a balanced day: show nothing.

**Before you trust it:**
> Act as a hostile reviewer. Find real bugs in this app — state that gets
> wiped, saves that can half-complete, anything that breaks on a phone.
> Prove each one, then fix it.

---

## Why the prompts look like this

- **Decisions are stated, not asked.** The stack, the look, the schema
  rules. An AI asked open questions makes average choices; an AI handed
  decisions builds fast and consistently.
- **The traps sections are the compressed cost of building it once.** Every
  line in them was a real bug in this repo.
- **"Exactly these, nothing more" is what keeps a v1 finishable.** Scope is
  the thing beginners lose first.
- **Level 1 before Level 2.** A working thing today beats a perfect thing
  never. The database is an upgrade, not a wall.
