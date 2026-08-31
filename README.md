# Workout Logger

The full version of the tracker from **Ep. 1**. That episode builds a single-file
logger in one prompt, no account, no database — start there if you just want the
thing on your phone: **[github.com/ohwisey/ep1](https://github.com/ohwisey/ep1)**

This repo is the grown-up version: Next.js, Supabase, real auth, a 57-exercise
library, per-exercise graphs and a clean export you can hand to any AI. Same idea,
more machine. It runs local-only with browser storage if you skip the Supabase
setup, so you can try it before wiring anything up.

Questions, or want to show what you built: **[discord.gg/A8bzYw6cCF](https://discord.gg/A8bzYw6cCF)**

---

A deliberately small workout data app:

1. Build a workout day from a 57-exercise library.
2. Log the weight and reps you actually completed.
3. See one graph per exercise and copy clean history for any other tool.

It also supports permanent custom exercises with a camera photo, so a unique gym machine can keep its own history.

## Run locally

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Without Supabase variables the app automatically runs in local-only demo mode using browser storage.

## Cloud setup

1. Apply every SQL file in `supabase/migrations` in filename order (or run `supabase db push`).
2. Add the project URL and publishable key to `.env.local`.
3. Add the same variables in Vercel.
4. Deploy the repository.

The migration uses isolated `wl_*` tables, authenticated-only RLS policies, and a private photo bucket. It does not modify the original Vitality tables.

## Signing in

Sign-in is a one-time step. The Supabase session is stored in the browser and refreshed
automatically, so closing the browser, refreshing, reopening a bookmark, or redeploying
the same Vercel project all reopen straight to the workout. The app checks for an existing
session before it renders anything and shows a loading screen while it checks, so a
signed-in user never sees the login form. Nothing signs you out except pressing
**Log out** in Settings.

Bookmark the **production** domain (your own Vercel production domain, not a preview URL).
That domain is stable across redeploys. Vercel preview and per-deployment URLs are
different origins, so they hold their own separate session and will ask you to sign in
again — they are not a substitute for the production bookmark.

## Deploying

Vercel blocks a deployment when the author of the deployed commit is not a member of the
Vercel team, with `the commit author does not have contributing access to the project`.
The push can succeed while every deploy is silently blocked, so check that a new
deployment actually reached **Ready** rather than assuming a green push means a live site.
Set the repository's commit author to the same identity that owns the Vercel project:

```bash
git config user.name "<vercel-account-github-login>"
git config user.email "<id>+<login>@users.noreply.github.com"
```

## Scope

Included: plans, real set logging, history graphs, copy/export, custom exercises and photos.

Not included: AI coaching, automatic programming, wearable data, cardio, deloads, or a dashboard.

## Third-party exercise images

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). This app is released under the MIT License; the bundled exercise-reference dataset retains its Unlicense terms.
