// Postgres (Neon) over HTTP — works in serverless without connection pools.
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  throw new Error('DATABASE_URL/POSTGRES_URL not set. Run `vercel env pull .env.local` and source it locally.');
}

// `sql` is a tagged-template function: sql`SELECT ... WHERE id = ${id}`.
// It safely parameterises the interpolations as $1, $2, ...
export const sql = neon(url);

// Idempotent schema init. Called once at boot and from the `init-db` script.
export async function initSchema(){
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Username uniqueness is case-insensitive — match SQLite's COLLATE NOCASE.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username))`;

  // Online-presence: bumped by /api/online/heartbeat. NULL on legacy rows.
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ`;

  await sql`
    CREATE TABLE IF NOT EXISTS matches (
      id               SERIAL PRIMARY KEY,
      user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      result           TEXT NOT NULL CHECK (result IN ('win','loss','draw')),
      user_color       TEXT NOT NULL CHECK (user_color IN ('w','b')),
      opponent         TEXT NOT NULL DEFAULT 'computer',
      difficulty       TEXT,
      ending_type      TEXT,
      num_moves        INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      played_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at)`;

  // ====== Online multiplayer tables ======
  await sql`
    CREATE TABLE IF NOT EXISTS challenges (
      id            SERIAL PRIMARY KEY,
      challenger_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenged_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status        TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','declined','expired','cancelled')),
      game_id       INTEGER,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON challenges(challenged_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(challenger_id, status)`;

  // Online games (vs human). FEN stores full board state — load with `new Chess(fen)`.
  await sql`
    CREATE TABLE IF NOT EXISTS games (
      id               SERIAL PRIMARY KEY,
      white_player_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      black_player_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fen              TEXT NOT NULL,
      turn             TEXT NOT NULL CHECK (turn IN ('w','b')),
      status           TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','checkmate','stalemate','draw','abandoned','resigned')),
      winner_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ending_type      TEXT,
      num_moves        INTEGER NOT NULL DEFAULT 0,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_games_white ON games(white_player_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_games_black ON games(black_player_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS moves (
      id           SERIAL PRIMARY KEY,
      game_id      INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_square  TEXT NOT NULL,
      to_square    TEXT NOT NULL,
      promotion    TEXT,
      san          TEXT,
      move_number  INTEGER NOT NULL,
      fen_after    TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_moves_game ON moves(game_id, move_number)`;
}

// Run init once per process. The promise is awaited at the top of routes
// to ensure the schema exists before the first query.
let initPromise = null;
export function ensureSchema(){
  if (!initPromise) initPromise = initSchema();
  return initPromise;
}
