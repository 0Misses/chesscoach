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
}

// Run init once per process. The promise is awaited at the top of routes
// to ensure the schema exists before the first query.
let initPromise = null;
export function ensureSchema(){
  if (!initPromise) initPromise = initSchema();
  return initPromise;
}
