// Match save + per-user stats.
import { Router } from 'express';
import { sql, ensureSchema } from './db.js';
import { requireAuth } from './middleware.js';

const router = Router();

const VALID_RESULT = new Set(['win', 'loss', 'draw']);
const VALID_COLOR  = new Set(['w', 'b']);
const VALID_ENDING = new Set(['checkmate', 'stalemate', 'resignation', 'draw']);

router.post('/matches', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const { result, user_color, difficulty, ending_type, num_moves, duration_seconds } = req.body || {};

    if (!VALID_RESULT.has(result))    return res.status(400).json({ error: 'result must be win|loss|draw' });
    if (!VALID_COLOR.has(user_color)) return res.status(400).json({ error: 'user_color must be w|b' });
    if (ending_type != null && !VALID_ENDING.has(ending_type)){
      return res.status(400).json({ error: 'invalid ending_type' });
    }

    const moves = Number.isFinite(num_moves) ? Math.max(0, Math.floor(num_moves)) : 0;
    const dur   = Number.isFinite(duration_seconds) ? Math.max(0, Math.floor(duration_seconds)) : 0;
    const diff  = typeof difficulty === 'string' ? difficulty.slice(0, 32) : null;
    const end   = ending_type || null;

    const rows = await sql`
      INSERT INTO matches
        (user_id, result, user_color, opponent, difficulty, ending_type, num_moves, duration_seconds)
      VALUES
        (${req.user.id}, ${result}, ${user_color}, 'computer', ${diff}, ${end}, ${moves}, ${dur})
      RETURNING id
    `;
    res.status(201).json({ id: rows[0].id });
  } catch (e){ next(e); }
});

// Streaks computed in JS from match history (newest first).
function computeStreaks(matchesNewestFirst){
  let current = 0;
  for (const m of matchesNewestFirst){
    if (m.result === 'win') current += 1;
    else break;
  }
  let best = 0, run = 0;
  for (let i = matchesNewestFirst.length - 1; i >= 0; i--){
    if (matchesNewestFirst[i].result === 'win'){ run += 1; if (run > best) best = run; }
    else run = 0;
  }
  return { current_streak: current, best_streak: best };
}

router.get('/stats/me', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const id = req.user.id;
    const aggRows = await sql`
      SELECT
        COUNT(*)::int                                              AS total,
        SUM(CASE WHEN result = 'win'  THEN 1 ELSE 0 END)::int      AS wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END)::int      AS losses,
        SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END)::int      AS draws,
        SUM(CASE WHEN user_color = 'w' THEN 1 ELSE 0 END)::int     AS as_white,
        SUM(CASE WHEN user_color = 'b' THEN 1 ELSE 0 END)::int     AS as_black,
        AVG(duration_seconds)::float                               AS avg_duration,
        AVG(num_moves)::float                                      AS avg_moves
      FROM matches WHERE user_id = ${id}
    `;
    const agg = aggRows[0] || {};
    const total = agg.total || 0;
    const wins = agg.wins || 0;

    const all = await sql`
      SELECT id, result, user_color, opponent, difficulty, ending_type,
             num_moves, duration_seconds, played_at
      FROM matches WHERE user_id = ${id}
      ORDER BY played_at DESC, id DESC
    `;
    const recent = all.slice(0, 10);
    const { current_streak, best_streak } = computeStreaks(all);

    res.json({
      user: { id, username: req.user.username },
      stats: {
        total,
        wins,
        losses: agg.losses || 0,
        draws: agg.draws || 0,
        win_rate: total > 0 ? wins / total : 0,
        current_streak,
        best_streak,
        avg_duration_seconds: agg.avg_duration ? Math.round(agg.avg_duration) : 0,
        avg_moves: agg.avg_moves ? Math.round(agg.avg_moves * 10) / 10 : 0,
        as_white: agg.as_white || 0,
        as_black: agg.as_black || 0
      },
      recent_matches: recent
    });
  } catch (e){ next(e); }
});

export default router;
