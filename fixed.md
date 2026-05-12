# AR Chess Audit: Findings And Fixes

## What I Found

- The repo already had uncommitted work before my changes:
  - Modified: `README.md`, `index.html`, `lib/app.js`, `lib/db.js`, `package-lock.json`, `package.json`
  - Untracked: `lib/online-routes.js`
- `npm run dev` was broken locally because `server/local.js` imported the app before loading `.env.local`.
- `JWT_SECRET` was missing from `.env.local`.
- Missing `JWT_SECRET` caused auth to fail during token signing. In the register flow, this could happen after the user row was already inserted.
- `/api/games/mine/recent` was declared after `/api/games/:id`, so Express treated `mine` as a game id and returned `Bad game id`.
- The project has no lint, build, or test scripts. Available scripts are only `dev` and `init-db`.
- Online game writes are not transactional, so concurrent accept/move race conditions are still possible.
- ID parsing uses `parseInt`, so values like `123abc` can be accepted as `123`.
- CORS defaults to `*`, which is convenient locally but should be tightened if frontend and backend are hosted separately.
- JWTs are stored in `localStorage`, so an XSS bug would expose tokens.
- I could not test real AR camera/marker detection because that requires an interactive browser and camera session.

## What I Fixed

- Fixed local dev startup in `server/local.js`.
  - `.env.local` and `.env` are now loaded before importing the app.
  - The app is imported dynamically after env loading.
- Added fail-fast JWT configuration validation in `lib/app.js`.
  - The app now throws immediately if `JWT_SECRET` is missing.
  - This prevents partially working auth flows that fail later during token signing.
- Fixed `/api/games/mine/recent` in `lib/online-routes.js`.
  - Moved the literal `/games/mine/recent` route above `/games/:id`.
  - This prevents Express from matching `mine` as the `:id` parameter.

## What I Verified

- `npm run init-db` succeeded.
- Syntax checks passed:
  - `node --check lib/app.js`
  - `node --check server/local.js`
  - `node --check lib/online-routes.js`
- Local API smoke test passed with two throwaway users:
  - Register Alice and Bob
  - Heartbeat
  - Search users
  - Send challenge
  - Reject self-challenge
  - Reject duplicate pending challenge
  - Accept challenge
  - Confirm both users load the same game
  - Make legal moves
  - Reject wrong-turn move
  - Load recent games
  - Resign game
  - Confirm final game status is `resigned`

## Files Changed

- `lib/app.js`
- `server/local.js`
- `lib/online-routes.js`
- `fixed.md`

## Commands To Run

Add a local JWT secret before running the app normally:

```powershell
$secret = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
Add-Content .env.local "JWT_SECRET=$secret"
```

Then run:

```powershell
npm run init-db
npm run dev
```
