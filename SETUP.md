# Dark Matter — Setup & Deploy

A static PWA (`index.html` landing + `darkmatter.html` app) backed by Netlify
Functions, with persistent storage via **Netlify Blobs** and auto-posting via a
**Scheduled Function**.

```
darkmatter/
├── index.html              landing page
├── darkmatter.html         the app (markets / blog / chat / marketplace / profile)
├── manifest.json           PWA manifest (installable)
├── netlify.toml            Netlify config (functions + hourly schedule)
├── package.json            function dependencies (Blobs + Functions SDK)
└── netlify/functions/
    ├── lib/shared.js        shared helpers (storage, prompts, Anthropic call)
    ├── claude.js            POST: market insight + manual post generation
    ├── posts.js             GET list / POST add|delete blog posts
    ├── chat.js              GET messages / POST send|clear (public room)
    ├── config.js            GET/POST schedule + weekly topics
    └── scheduler.js         runs hourly, auto-publishes briefs + weekly blog
```

## 1. Environment variables (required)

In Netlify → **Site configuration → Environment variables**, add:

| Key | Value | Used for |
|-----|-------|----------|
| `ANTHROPIC_API_KEY` | your Anthropic API key | AI insights, daily briefs, weekly blog |
| `ADMIN_PASSWORD` | a secret you choose | authorizes admin writes (delete posts, clear chat, save schedule) |

> The in-app admin gate code is `971997` (triple-tap the logo, or Profile →
> Admin access). Change it in `darkmatter.html` (`ADMIN_GATE`). For real
> protection, the **server** checks `ADMIN_PASSWORD` on every write — set it.
> If you don't set `ADMIN_PASSWORD`, the server falls back to `971997` so it
> still works out of the box.

## 2. Deploy

### Option A — GitHub (recommended, enables auto-deploys + cron)
1. Push this folder to a GitHub repo.
2. Netlify → **Add new site → Import from Git** → pick the repo.
3. Build command: *(leave blank)*. Publish directory: `.`
4. Add the env vars from step 1, then **Deploy**.

### Option B — Drag & drop
1. Netlify dashboard → drag the `darkmatter` folder onto the deploy area.
2. Add the env vars from step 1, then **Trigger deploy** again so functions pick them up.

Either way Netlify auto-installs `package.json` deps, bundles the functions,
and registers the hourly schedule. **Netlify Blobs needs no setup** — storage
is provisioned automatically for the site.

## 3. How the automation works

- The browser fetches **live prices from CoinGecko** every 60s (client-side).
- `scheduler.js` runs **every hour**. It reads your schedule from Blobs, checks
  the current **Central (America/Chicago)** time, and:
  - at your **morning hour** → publishes a "day ahead" brief
  - at your **afternoon hour** → publishes a "where we stand" recap
  - on your **weekly day + hour** → writes a deep-dive from the **next topic**
    in your list (it rotates through them)
- Run-markers prevent double-posting if a run overlaps.

### Editing the schedule
Open the app → triple-tap the **DarkMatter** logo (or Profile → Admin access) →
enter the gate code → set morning/afternoon times, weekly day/time, and paste
your **weekly topics (one per line)** → **Save**. Changes take effect on the
next hourly run. Defaults: 7 AM + 3 PM briefs, Sunday 9 AM weekly.

> Cron precision: because the scheduler runs hourly, posts publish at the top of
> the chosen hour (e.g. "7 AM" → ~7:00). All times are Central and DST-aware.

## 4. Test checklist after deploy
- App loads, prices show, "DM Market Intel" fills in (proves `claude.js` + key).
- **Chat**: pick a handle, send a message, open in a 2nd browser → both see it.
- **Admin → Generate Market Update Now** → a DAILY post appears in Blog.
- **Admin → Clear chat** → messages wiped.
- Add a weekly topic + set the weekly time to the next hour to watch it fire.

## Local note
Opening `darkmatter.html` directly as a file works for the **UI**, but the
functions (chat, saved posts, AI, scheduling) only run on a deployed Netlify
site (or via `netlify dev`). The app degrades gracefully — it falls back to
seed blog posts and shows a "backend needed" note in chat.
