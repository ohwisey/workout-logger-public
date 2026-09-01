# Workout Logger

> **v1 — rough on purpose.** This is what I actually use, not a
> finished product. Some of it will break. Tell me in the Discord
> and I'll fix it.

Log your sets. See your graphs. Copy your whole history into Claude
or ChatGPT and ask it what's actually going on with your training.

<p align="center">
  <img src="docs/screenshot-history.png" alt="History screen: best weight per exercise and a button that copies your real data" width="320">
</p>

That bottom card is the point. One tap and your real training data is
in your clipboard, ready to paste anywhere.

**Want the simple version instead?** Ep. 1 builds a single-file
logger in one prompt — no accounts, on your phone in 10 minutes:
[github.com/ohwisey/ep1](https://github.com/ohwisey/ep1)

---

## Run it (no experience needed)

**1.** Install Claude Code:

```
npm install -g @anthropic-ai/claude-code
```

(No `npm`? Install Node.js from nodejs.org first — big download button.)

**2.** Get the code and open Claude in it:

```
git clone https://github.com/ohwisey/workout-logger-public.git
cd workout-logger-public
claude
```

**3.** Paste this:

```
Get this Next.js app running on my computer. Skip Supabase — it runs
local-only without it. Then fill it with about a month of realistic
fake workout data so I can see the graphs before I log anything.
Install what's needed, start it, and give me the URL. Fix anything
that breaks and explain what you're doing in plain English.
```

Claude does the rest and hands you a link. Your data stays in your
browser — nothing is uploaded.

---

## Then, when you want more

Just ask Claude, in the same window:

```
Deploy this to Vercel so I can open it on my phone.
```

```
Set up Supabase so my data syncs between my laptop and my phone.
Walk me through the account steps and never show my keys on screen.
```

```
Add a body-weight field and show it on the graph.
```

It's yours now. Change whatever you want.

---

Questions, or show me what you built:
**[discord.gg/A8bzYw6cCF](https://discord.gg/A8bzYw6cCF)**

---

<details>
<summary>For developers</summary>

`pnpm install && pnpm dev`. Without Supabase env vars it runs
local-only on browser storage. Cloud: apply every SQL file in
`supabase/migrations` in filename order, put the project URL and
publishable key in `.env.local` and in Vercel. Isolated `wl_*`
tables, authenticated-only RLS, private photo bucket.

Deploying from a fork: Vercel blocks a deploy when the commit author
isn't on the Vercel team, and the push still looks green — confirm
the deployment reached **Ready**.

Exercise images: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
MIT licensed; the bundled exercise dataset keeps its Unlicense terms.
</details>
