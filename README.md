# AR Chess

Web-based augmented-reality chess. Point your phone camera at a printed marker, the 3D board appears anchored on top, tap pieces to move, play against a ~1200 ELO AI. With **user accounts, match history, stats, and a leaderboard** — frontend and backend both deployed on Vercel, data in Neon Postgres.

🌐 **Live:** https://chesscoach-weld.vercel.app

## Features

- **Real AR** — image-tracking via [MindAR](https://github.com/hiukim/mind-ar-js), no app install.
- **Touch controls** — tap a piece, legal squares glow green, illegal taps flash red.
- **Color choice** — pick White or Black, board auto-flips.
- **1200 ELO opponent** — depth-2 minimax with positional eval, blunder rate, noisy move selection.
- **User accounts** — register/login (JWT), passwords hashed with bcryptjs.
- **Match tracking** — every finished game (when logged in) is saved with result, color, moves, duration, and ending type.
- **Stats page** — total games, W/L/D, win rate, current & best win streak, avg moves, avg duration, white vs black, recent matches.
- **Leaderboard** — ranked by win rate / most wins / most games (≥3 games to qualify).
- **Guests still play** — AR chess works without an account; you'll be prompted to log in to save stats.

---

## Architecture

Frontend and backend are co-deployed on **Vercel**. The Express backend runs as a single Vercel function (`api/index.js`), and `vercel.json` rewrites all `/api/*` requests to it. The database is **Neon Postgres**, provisioned through Vercel's Marketplace integration.

```
chesscoach/
├── index.html              # Frontend (single-file SPA: AR chess + auth UI + stats/leaderboard)
├── package.json            # Backend deps + scripts
├── vercel.json             # Routes /api/* → api/index.js
├── api/
│   └── index.js            # Vercel function entrypoint
├── lib/                    # Shared backend code
│   ├── app.js              # Express app factory
│   ├── db.js               # Neon (Postgres) client + schema init
│   ├── init-db.js          # Standalone schema migration script
│   ├── auth-routes.js      # /api/register, /api/login, /api/me
│   ├── match-routes.js     # /api/matches, /api/stats/me
│   ├── leaderboard.js      # /api/leaderboard
│   └── middleware.js       # JWT verifier
└── server/
    └── local.js            # Local dev entry: runs the Express app on :3001
```

---

## Running locally

You need **Node.js 18+** and the Vercel CLI.

```bash
npm install
vercel link              # link to the existing chesscoach project (one-time)
vercel env pull .env.local --environment=production --yes
npm run init-db          # idempotent — creates tables if they don't exist
npm run dev              # local Express server on :3001
```

Then in a second terminal serve `index.html` with any static server:

```bash
npx serve .              # or python -m http.server 5500, or VS Code Live Server
```

Open the served URL. Camera/AR features need **HTTPS or localhost** — `file://` won't work.

The frontend auto-points to `http://localhost:3001` when on `localhost`. In production it uses same-origin (`/api/...`).

---

## Deploying

```bash
vercel deploy --prod
```

Pushes the static frontend AND the function — both end up on the same Vercel domain. CORS is permissive by default since same-origin in production.

### Environment variables (already set on Vercel)

- `JWT_SECRET` — token signing secret
- `DATABASE_URL` / `POSTGRES_URL` / etc. — auto-provisioned by the Neon integration

---

## How auth + stats work

1. **Register / Login** from the splash screen (or the HUD's `Login` button mid-session).
2. Once logged in, your username appears on the splash and in the HUD.
3. **Play a game** as usual. When the game ends:
   - Logged in → toast: *"Game saved to your stats"*. The match is POSTed to `/api/matches`.
   - Guest → toast: *"Login to save your game stats"*.
4. Open **Profile** to see your aggregate stats and recent games.
5. Open **Leaderboard** to see who's on top — switch between Win Rate / Most Wins / Most Games tabs. Users need **at least 3 games** to appear.

### What's stored per match
`result` (win/loss/draw), `user_color` (w/b), `opponent` (`computer`), `difficulty` (`1200`), `ending_type` (checkmate / stalemate / draw), `num_moves`, `duration_seconds`, `played_at`.

### Security notes
- Passwords are hashed with **bcryptjs** (cost 10), never stored in plaintext.
- Auth is **JWT** signed with `JWT_SECRET`. Tokens are stored in `localStorage` and sent as `Authorization: Bearer <token>`.
- All DB queries use the Neon tagged-template (`sql\`...${param}\``) which parameterises safely — no SQL injection.

---

## API reference

| Method | Path | Auth | Body / Query | Returns |
|--------|------|------|--------------|---------|
| `GET`  | `/api/health`        | — | — | `{ok:true}` |
| `POST` | `/api/register`      | — | `{username, password}` | `{token, user}` |
| `POST` | `/api/login`         | — | `{username, password}` | `{token, user}` |
| `GET`  | `/api/me`            | ✓ | — | `{user}` |
| `POST` | `/api/matches`       | ✓ | `{result, user_color, difficulty?, ending_type?, num_moves, duration_seconds}` | `{id}` |
| `GET`  | `/api/stats/me`      | ✓ | — | `{user, stats, recent_matches}` |
| `GET`  | `/api/leaderboard`   | — | `?sort=winrate\|wins\|games` | `{sort, entries}` |

---

## Tech

- **Frontend:** [Three.js](https://threejs.org/), [MindAR](https://github.com/hiukim/mind-ar-js), [chess.js](https://github.com/jhlywa/chess.js), vanilla JS via ES modules + import map. No build step.
- **Backend:** Express on Vercel Functions, [@neondatabase/serverless](https://www.npmjs.com/package/@neondatabase/serverless), bcryptjs, jsonwebtoken, cors.
- **DB:** Neon Postgres (serverless), provisioned via Vercel Marketplace.

---

## Notes / caveats

- Pieces are built from primitives so the file stays self-contained. Swap in glTF for fancier models.
- AI is intentionally weakened (depth-2 minimax + 18% blunder rate). Tune `chooseAIMove()`.
- Auto-promotes to queen.
- Marker image is MindAR's example "card" target. Replace `MIND_TARGET_URL` if you generate your own with [their compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile).
