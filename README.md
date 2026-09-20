# frommylens — booking site (Neon + Vercel functions)

Static HTML/CSS/JS frontend, plus two small Vercel serverless functions that talk to Neon Postgres. No local dev needed — this deploys the same way as your other Vercel projects.

## Files

- `index.html` — page structure
- `styles.css` — all styling (warm/cinematic theme, gold + sienna on deep umber)
- `script.js` — calendar, booking form, calls to `/api/*`, mobile nav
- `api/availability.js` — serverless function: returns booked/pending dates
- `api/bookings.js` — serverless function: inserts a new booking request
- `package.json` — declares the `@neondatabase/serverless` dependency
- `neon-setup.sql` — run once in the Neon SQL Editor to create the `bookings` table

## 1. Set up Neon

1. Create a new project at neon.tech (or use an existing one, matching how Sales Support Tracker is set up — a dedicated database in the same project is fine too).
2. Open the **SQL Editor** → paste in the contents of `neon-setup.sql` → run it.
3. Copy the **connection string** from the Neon dashboard (Connection Details — use the pooled connection string).

## 2. Set the environment variable in Vercel

1. In your Vercel project → **Settings → Environment Variables**.
2. Add `DATABASE_URL` = the Neon connection string from step 1.
3. That's the only secret this project needs — nothing goes in the repo itself, same as your other projects.

## 3. Photos — what's real vs. still placeholder

- **Logo** (header + footer) and **About section portrait** are now the real thing — pulled from what you sent, saved into `images/`. The logo got converted into a transparent PNG so it works on both the light header (`logo-ink.png`) and the dark footer (`logo-white.png`); `logo-sky.png` is a spare sky-blue-tinted version if you want it somewhere later.
- Everything else — hero background, the film-strip frames, the four service cards — is still a styled placeholder (a dark-on-light gradient block with a small caption in the corner, e.g. "Portrait sample", "Hero photo or looping clip"). Send more shots whenever you have them and I'll swap them in directly. To do it yourself, the pattern is:

```html
<!-- before -->
<div class="hero-frame placeholder-frame" data-placeholder-note="...">

<!-- after -->
<div class="hero-frame">
  <img src="images/hero.jpg" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">
</div>
```

Same pattern for the film strip frames (in `script.js`, the placeholder-generation loop near `frameLabels`) and the service cards.

## 4. Update pricing

The package prices in the Services section (`₦45,000`, `₦120,000`, etc. in `index.html`) are placeholders — there's an italic note under the cards flagging this. Swap in real numbers and delete the note before this goes live.

## 5. Deploy

1. Push this folder to a new GitHub repo.
2. Import it into Vercel (GitHub-connected). Vercel auto-detects the `api/` folder as serverless functions — no build config needed.
3. Add the `DATABASE_URL` env var (step 2) before or right after the first deploy.
4. Done.

## How bookings work

- Visitor picks an open date → fills in the form → submits.
- This calls `POST /api/bookings`, which inserts a row into `bookings` with `status = 'pending'`. Nothing is charged or confirmed automatically.
- You review requests directly in Neon (SQL Editor: `select * from bookings order by created_at desc;`, or the table view in the dashboard) and confirm manually by email/WhatsApp — same as your usual flow.
- To mark a date as taken, set that row's `status` to `confirmed` (or leave it `pending` — both block the date on the public calendar, via `GET /api/availability`). Set it to `declined` or `cancelled` to free the date back up.
- A unique index (`bookings_active_date_unique`) prevents two active bookings landing on the same date, as a backstop against double-booking race conditions — `/api/bookings.js` returns a clear "that date was just taken" response if it happens.

## Why the API layer (vs. calling Neon straight from the browser)

Neon doesn't have Supabase's auto-generated REST layer + row-level security, so there's no safe way to query it directly from client-side JS without exposing the connection string. The two functions in `/api` are the whole backend: `availability.js` only ever reads `shoot_date`, `bookings.js` only ever inserts. Contact details (name, email, phone) never touch the browser after submission — same privacy posture as before, just enforced in code instead of RLS policies.

## Notes

- No payment step — request-only, confirmed manually, as scoped.
- If the API routes aren't deployed yet or `DATABASE_URL` isn't set, the site still works: the calendar shows and dates can be picked, but it says availability isn't live, and the form tells visitors to reach out directly instead of silently failing.
