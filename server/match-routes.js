// Save matches and compute stats. All endpoints require auth.
import { Router } from 'express';
import { stmts } from './db.js';
import { requireAuth } from './middleware.js';

const router = Router();

const VALID_RESULT = new Set(['win', 'loss', 'draw']);
const VALID_COLOR = new Set(['w', 'b']);
const VALID_ENDING = new Set(['checkmate', 'stalemate', 'resignation', 'draw', null, undefined]);

router.post('/matches', requireAuth, (req, res) => {
  const {
    result,
    user_color,
    difficulty,
    ending_type,
    num_moves,
    duration_seconds
  } = req.body || {};

  if (!VALID_RESULT.has(result)) {
    return res.status(400).json({ error: 'result must be win|loss|draw' });
  }
  if (!VALID_COLOR.has(user_color)) {
    return res.status(400).json({ error: 'user_color must be w|b' });
  }
  if (ending_type != null && !VALID_ENDING.has(ending_type)) {
    return res.status(400).json({ error: 'invalid ending_type' });
  }
  const moves = Number.isFinite(num_moves) ? Math.max(0, Math.floor(num_moves)) : 0;
  const dur = Number.isFinite(duration_seconds) ? Math.max(0, Math.floor(duration_seconds)) : 0;
  const diff = typeof difficulty === 'string' ? difficulty.slice(0, 32) : null;

  const info = stmts.insertMatch.run(
    req.user.id,
    result,
    user_color,
    'computer',
    diff,
    ending_type || null,
    moves,
    dur
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

// Compute streaks from match list (newest first in array).
function computeStreaks(matchesNewestFirst) {
  // Current streak: consecutive wins from the most recent match backward.
  let current = 0;
  for (const m of matchesNewestFirst) {
    if (m.result === 'win') current += 1;
    else break;
  }
  // Best streak: longest run of consecutive wins anywhere in history.
  let best = 0, run = 0;
  // Iterate chronologically (oldest -> newest) for clarity.
  for (let i = matchesNewestFirst.length - 1; i >= 0; i--) {
    if (matchesNewestFirst[i].result === 'win') {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return { current_streak: current, best_streak: best };
}

router.get('/stats/me', requireAuth, (req, res) => {
  const agg = stmts.userAggregate.get(req.user.id) || {};
  const total = agg.total || 0;
  const wins = agg.wins || 0;
  const losses = agg.losses || 0;
  const draws = agg.draws || 0;
  const recent = stmts.recentMatches.all(req.user.id, 10);
  const all = stmts.matchesByUser.all(req.user.id);
  const { current_streak, best_streak } = computeStreaks(all);

  res.json({
    user: { id: req.user.id, username: req.user.username },
    stats: {
      total,
      wins,
      losses,
      draws,
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
});

export default router;
