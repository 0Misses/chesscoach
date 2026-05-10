// SQLite setup. One file, one connection, prepared statements everywhere.
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'chess.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS matches (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    result           TEXT NOT NULL CHECK (result IN ('win','loss','draw')),
    user_color       TEXT NOT NULL CHECK (user_color IN ('w','b')),
    opponent         TEXT NOT NULL DEFAULT 'computer',
    difficulty       TEXT,
    ending_type      TEXT,
    num_moves        INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    played_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id);
  CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at);
`);

export const stmts = {
  insertUser: db.prepare(
    `INSERT INTO users (username, password_hash) VALUES (?, ?)`
  ),
  findUserByUsername: db.prepare(
    `SELECT id, username, password_hash, created_at FROM users WHERE username = ?`
  ),
  findUserById: db.prepare(
    `SELECT id, username, created_at FROM users WHERE id = ?`
  ),

  insertMatch: db.prepare(`
    INSERT INTO matches
      (user_id, result, user_color, opponent, difficulty, ending_type, num_moves, duration_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),

  // All matches for a user, newest first.
  matchesByUser: db.prepare(`
    SELECT id, result, user_color, opponent, difficulty, ending_type,
           num_moves, duration_seconds, played_at
    FROM matches
    WHERE user_id = ?
    ORDER BY played_at DESC, id DESC
  `),

  // Recent N matches for a user.
  recentMatches: db.prepare(`
    SELECT id, result, user_color, opponent, difficulty, ending_type,
           num_moves, duration_seconds, played_at
    FROM matches
    WHERE user_id = ?
    ORDER BY played_at DESC, id DESC
    LIMIT ?
  `),

  // Aggregate stats in one query.
  userAggregate: db.prepare(`
    SELECT
      COUNT(*)                                                        AS total,
      SUM(CASE WHEN result = 'win'  THEN 1 ELSE 0 END)                AS wins,
      SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END)                AS losses,
      SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END)                AS draws,
      SUM(CASE WHEN user_color = 'w' THEN 1 ELSE 0 END)               AS as_white,
      SUM(CASE WHEN user_color = 'b' THEN 1 ELSE 0 END)               AS as_black,
      AVG(duration_seconds)                                           AS avg_duration,
      AVG(num_moves)                                                  AS avg_moves
    FROM matches
    WHERE user_id = ?
  `),

  // Leaderboard: aggregate per user, filter to >=3 games. Caller picks ORDER BY.
  // We compute everything once and let the caller sort in JS — keeps SQL simple.
  leaderboardAll: db.prepare(`
    SELECT
      u.id,
      u.username,
      COUNT(m.id)                                                      AS games,
      SUM(CASE WHEN m.result = 'win'  THEN 1 ELSE 0 END)               AS wins,
      SUM(CASE WHEN m.result = 'loss' THEN 1 ELSE 0 END)               AS losses,
      SUM(CASE WHEN m.result = 'draw' THEN 1 ELSE 0 END)               AS draws
    FROM users u
    JOIN matches m ON m.user_id = u.id
    GROUP BY u.id, u.username
    HAVING COUNT(m.id) >= 3
  `)
};
