# Hoops Live

Track high school basketball stats live from a YouTube stream, while people in the gym follow along on their phones.

- **Scorer view** (you): a tap-to-log pad (watch the stream on another screen). Tap a player, then an action. Undo, subs, fouls, assist/rebound follow-ups, both teams.
- **Viewer page** (everyone else): open a link or scan a QR code. Live score, play-by-play, line score and box scores for both teams. No sign-in.

Stats are an **event log**: every tap is one row, and the box score, score, fouls and +/- are all derived from it. That's what makes undo and fixing mistakes safe.

## Try it right now (no setup)

```bash
npm install
npm run dev
```

With no Supabase keys, it runs in **demo mode**: data lives in your browser and syncs between tabs, so you can open the scorer in one tab and the viewer link in another. Nothing is shared with other devices until you do the setup below.

## Go live (about 15 minutes, one time)

### 1. Create the backend (Supabase, free tier)
1. Create a project at supabase.com.
2. **SQL Editor** → paste all of `supabase/schema.sql` → **Run**.
3. **Authentication → Users → Add user**: create your own email + password (tick "auto confirm").
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". This matters. Anyone signed in can edit stats, so you want only your account to exist.
5. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

### 2. Run locally with the keys
```bash
cp .env.example .env.local   # paste the two values in
npm run dev
```
Sign in with the account from step 1.3, create a game, and open the viewer link on your phone.

### 3. Put it online (GitHub Pages)
1. Push this folder to a GitHub repo (branch `main`).
2. Repo **Settings → Pages → Source: GitHub Actions**.
3. Repo **Settings → Secrets and variables → Actions → Variables** → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. (The anon key is designed to be public. Row-level security in `schema.sql` is what protects writes.)
4. Push. The included workflow tests, builds and deploys. Your site is at `https://<you>.github.io/<repo>/`.

## Game day

1. Open the site on your computer, sign in, **New game**. Paste the roster (`23 Jake Smith` per line, saved for next time) and pick 5 starters. Keep the YouTube stream open on your other device.
2. Tap **Share** and send the link or QR to the gym (group chat, a sign by the door).
3. Watch the stream, tap stats. **Tap a player, then an action.**
   - Made 2/3 → asks "Assist by?" (skippable).
   - Missed shot → asks "Rebound by?" (skippable).
   - **Bench player → tap an on-court player** to sub.
   - Opponent: tap the **Opponent tab**, **+ #** to add a jersey number the first time you see it. **TEAM / ?** logs to the team when you can't read the number.
   - **Undo last play** removes the last action together with its linked assist/rebound. In the play log, ✕ removes any single play.
4. **End game** when it's over. The viewer page shows FINAL and stays available.

## Rules assumed
- Fouls: 5 per player disqualifies (highlighted red). Team fouls reset each quarter, overtime continues the 4th-quarter count, and **BONUS** shows at 5 team fouls (NFHS rules). Change `BONUS_AT` in `src/lib/stats.js` if your league differs.
- No game clock is tracked. Plays are ordered by when you tap them.

## Notes
- **Offline-safe scorer:** every tap is saved on your device first and queued for upload. If your wifi drops, keep tapping. The header shows "Saving… n" until it catches up.
- **Viewers see the real game before the stats**, since the stats follow your stream by however many seconds the stream is delayed. The page shows a "last updated" time so a quiet stretch doesn't look broken.
- Supabase free projects pause after about a week of no activity. If the site goes quiet in the offseason, un-pause it from the Supabase dashboard.

## Project layout
```
src/lib/stats.js          pure stats engine (replays the event log), unit tested
src/lib/sync.js           outbox queue + hooks for scorer (local-first) and viewer (realtime)
src/lib/remote*.js        Supabase backend, or local demo backend
src/components/           Setup, Scorer, Viewer, BoxScore, ...
supabase/schema.sql       tables + row-level security + realtime
tests/                    npm test
```
