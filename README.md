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
- **Online multiplayer** — search users by username, send challenges, play live human-vs-human chess on a 2D board with turn enforcement and game-over detection.
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
│   ├── online-routes.js    # online multiplayer: search, challenges, games, moves
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
| `POST` | `/api/online/heartbeat`        | ✓ | — | `{ok}` |
| `GET`  | `/api/users/search`            | ✓ | `?username=<prefix>` | `{users:[{id,username,online}]}` |
| `POST` | `/api/challenges`              | ✓ | `{challenged_username}` | `{challenge}` |
| `GET`  | `/api/challenges/incoming`     | ✓ | — | `{challenges}` |
| `GET`  | `/api/challenges/outgoing`     | ✓ | — | `{challenges}` |
| `POST` | `/api/challenges/:id/accept`   | ✓ | — | `{ok, game_id}` |
| `POST` | `/api/challenges/:id/decline`  | ✓ | — | `{ok}` |
| `POST` | `/api/challenges/:id/cancel`   | ✓ | — | `{ok}` |
| `GET`  | `/api/games/:id`               | ✓ | — | `{game, moves}` |
| `POST` | `/api/games/:id/move`          | ✓ | `{from, to, promotion?}` | `{ok, fen, turn, status, version, move}` |
| `POST` | `/api/games/:id/resign`        | ✓ | — | `{ok, winner_id}` |
| `GET`  | `/api/games/mine/recent`       | ✓ | — | `{games}` |

---

## Online multiplayer

### How it works

1. Sign in (multiplayer requires an account).
2. Click **Online Play** (splash or HUD).
3. Type a username — search results show a green dot for users currently online.
4. **Send Challenge**. The other user gets an in-app popup with **Accept / Decline**.
5. On accept, both users are auto-routed into a shared 2D board. Colors are randomized.
6. Take turns clicking your piece, then its destination. Server validates every move; illegal moves flash red. The HUD always shows whose turn it is.
7. The first checkmate / stalemate / resignation ends the game and shows the result; click **Back to lobby** to return.

### Real-time strategy

The spec recommends Socket.IO. This project is deployed on **Vercel Serverless Functions**, which terminate after each request and can't hold persistent WebSocket connections — Socket.IO requires a long-running host. To keep deploy on one platform, multiplayer uses the spec's stated fallback: short-interval **HTTP polling** (2–3 s) for challenge updates and game state. The data model is designed so a Socket.IO layer could be added later without changes.

- `GET /api/challenges/incoming` — polled every 3 s in the background (incoming popup).
- `GET /api/challenges/outgoing` — polled in the background; auto-jumps the challenger into the game on accept.
- `GET /api/games/:id` — polled every 2 s while a game screen is open. The `version` field (server `num_moves`) lets the client skip rerenders when nothing changed.
- `POST /api/online/heartbeat` — every 15 s while signed in, bumps `users.last_seen` so others see "online".

### Testing with two users

1. `npm run dev` (terminal A) and serve `index.html` (`npx serve .` in terminal B).
2. Open the site in **two different browser windows** (or a regular window + an incognito window — important so they have separate `localStorage` tokens).
3. Register two accounts: e.g. `alice` and `bob`.
4. In each window, click **Online Play**.
5. From Alice, search `bob` → **Send Challenge**.
6. Bob sees a popup → **Accept**. Both windows jump into the multiplayer board.
7. Make moves on the side whose turn it is; the other window updates within ~2 s.
8. End the game with checkmate or **Resign / Leave** to see the result screen.

### Database schema additions

- `users.last_seen TIMESTAMPTZ` — heartbeat presence column (added via `ALTER TABLE … IF NOT EXISTS`).
- `challenges` — `id, challenger_id, challenged_id, status, game_id, created_at, updated_at`. Statuses: `pending | accepted | declined | expired | cancelled`.
- `games` — `id, white_player_id, black_player_id, fen, turn, status, winner_id, ending_type, num_moves, created_at, updated_at`. Statuses: `active | checkmate | stalemate | draw | abandoned | resigned`. Board state is full FEN.
- `moves` — `id, game_id, player_id, from_square, to_square, promotion, san, move_number, fen_after, created_at`.

Apply with: `npm run init-db` (idempotent).

### Security

- All endpoints require `Authorization: Bearer <jwt>` (existing middleware).
- Server is authoritative for moves: loads the stored FEN, re-validates the move with `chess.js`, rejects illegal moves and out-of-turn moves with a 4xx error.
- Challenge ownership is checked on accept / decline / cancel (only the appropriate party can act).

---

## Tech

- **Frontend:** [Three.js](https://threejs.org/), [MindAR](https://github.com/hiukim/mind-ar-js), [chess.js](https://github.com/jhlywa/chess.js), vanilla JS via ES modules + import map. No build step.
- **Backend:** Express on Vercel Functions, [@neondatabase/serverless](https://www.npmjs.com/package/@neondatabase/serverless), [chess.js](https://github.com/jhlywa/chess.js) (server-side move validation), bcryptjs, jsonwebtoken, cors.
- **DB:** Neon Postgres (serverless), provisioned via Vercel Marketplace.

---

## Notes / caveats

- Pieces are built from primitives so the file stays self-contained. Swap in glTF for fancier models.
- AI is intentionally weakened (depth-2 minimax + 18% blunder rate). Tune `chooseAIMove()`.
- Auto-promotes to queen.
- Marker image is MindAR's example "card" target. Replace `MIND_TARGET_URL` if you generate your own with [their compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile).
