# AR Chess

Web-based augmented-reality chess. Point your phone camera at a printed marker, the 3D board appears anchored on top, tap pieces to move, play against a ~1200 ELO AI. Now with **user accounts, match history, stats, and a leaderboard** backed by a small Node + SQLite API.

## Features

- **Real AR** — image-tracking via [MindAR](https://github.com/hiukim/mind-ar-js), no app install.
- **Touch controls** — tap a piece, legal squares glow green, illegal taps flash red.
- **Color choice** — pick White or Black, board auto-flips.
- **1200 ELO opponent** — depth-2 minimax with positional eval, blunder rate, noisy move selection.
- **User accounts** — register/login (JWT), passwords bcrypted.
- **Match tracking** — every finished game (when logged in) is saved with result, color, moves, duration, and ending type.
- **Stats page** — total games, W/L/D, win rate, current & best win streak, avg moves, avg duration, white vs black, recent matches.
- **Leaderboard** — ranked by win rate / most wins / most games (≥3 games to qualify).
- **Guests still play** — AR chess works without an account; you'll be prompted to log in to save stats.

---

## Project layout

```
chesscoach/
├── index.html         # Frontend: AR chess + auth UI + stats/leaderboard panels
├── server/            # Backend: Express + SQLite
│   ├── server.js
│   ├── db.js
│   ├── auth-routes.js
│   ├── match-routes.js
│   ├── leaderboard.js
│   ├── middleware.js
│   ├── package.json
│   └── .env.example
└── README.md
```

---

## Running locally

You need **Node.js 18+**. Two terminals: one for the API, one for the static frontend.

### 1. Start the backend

```bash
cd server
cp .env.example .env       # Windows: copy .env.example .env
# Open .env and replace JWT_SECRET with a long random string.
# Quick generator:  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm install
npm start
```

You should see `AR Chess server listening on :3001`. The SQLite file `chess.db` is created automatically on first run.

### 2. Serve the frontend

The frontend is one static `index.html`. From the project root, in another terminal:

```bash
# Pick any of these — they all work:
npx serve .                       # serves on :3000 by default
# or:
python -m http.server 5500
# or use VS Code Live Server on port 5500
```

Open the served URL (e.g. `http://localhost:5500`). Camera/AR features need **HTTPS or localhost** — `file://` won't work.

The frontend auto-points to `http://localhost:3001` when running on `localhost`. For deployed builds, see below.

---

## How auth + stats work

1. **Register / Login** from the splash screen (or the HUD's `Login` button mid-session).
2. Once logged in, your username appears on the splash and in the HUD.
3. **Play a game** as usual. When the game ends:
   - Logged in → toast: *"Game saved to your stats"*. The match is POSTed to `/api/matches`.
   - Guest → toast: *"Login to save your game stats"*.
4. Open **Profile** (HUD or splash) to see your aggregate stats and recent games.
5. Open **Leaderboard** to see who's on top — switch between Win Rate / Most Wins / Most Games tabs. Users need **at least 3 games** to appear.

### What's stored per match
`result` (win/loss/draw), `user_color` (w/b), `opponent` (`computer`), `difficulty` (`1200`), `ending_type` (checkmate / stalemate / draw), `num_moves`, `duration_seconds`, `played_at`.

### Security notes
- Passwords are hashed with **bcrypt** (cost 10), never stored in plaintext.
- Auth is **JWT** signed with `JWT_SECRET`. Tokens are stored in `localStorage` and sent as `Authorization: Bearer <token>`.
- All DB queries use **prepared statements** (no SQL injection).
- CORS is restricted to the origins listed in `CORS_ORIGIN`.

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

## Deploying

### Backend (Render free tier)

1. Push this repo to GitHub.
2. On [Render](https://render.com), New → **Web Service** → connect the repo.
3. Settings:
   - **Root directory:** `server`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Add env vars:
   - `JWT_SECRET` — long random string
   - `CORS_ORIGIN` — your GitHub Pages URL (e.g. `https://yourname.github.io`), comma-separated if you want multiple
5. Deploy. You get a URL like `https://ar-chess-api.onrender.com`.

> ⚠️ **Free-tier caveats**
> - The service **sleeps after 15 min idle**; the first request after sleep takes ~30 seconds.
> - Render's free disk is **ephemeral** — `chess.db` is reset on every redeploy. For persistence, attach a Render disk or upgrade. Fine for a uni demo; not fine for real users.

### Frontend (GitHub Pages)

1. Edit `index.html` and replace `https://YOUR-RENDER-APP.onrender.com` with your real Render URL (search for `YOUR-RENDER-APP`).
2. Commit, push.
3. Repo → **Settings → Pages → Source: `main` / root → Save**.
4. App live at `https://yourname.github.io/chesscoach/`.

---

## Tech

- **Frontend:** [Three.js](https://threejs.org/), [MindAR](https://github.com/hiukim/mind-ar-js), [chess.js](https://github.com/jhlywa/chess.js), vanilla JS via ES modules + import map. No build step.
- **Backend:** Express, better-sqlite3, bcrypt, jsonwebtoken, cors, dotenv.
- **DB:** SQLite, single file (`server/chess.db`).

---

## Notes / caveats

- Pieces are built from primitives so the file stays self-contained. Swap in glTF for fancier models.
- AI is intentionally weakened (depth-2 minimax + 18% blunder rate). Tune `chooseAIMove()`.
- Auto-promotes to queen.
- The marker image is MindAR's example "card" target. Replace `MIND_TARGET_URL` if you generate your own with [their compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile).
- Resigning isn't a UI feature yet — only checkmate / stalemate / 50-move / threefold / insufficient material end the game.
