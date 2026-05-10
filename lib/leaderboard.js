// Public leaderboard (no auth). Min 3 games to qualify.
import { Router } from 'express';
import { sql, ensureSchema } from './db.js';

const router = Router();
const VALID_SORTS = new Set(['winrate', 'wins', 'games']);

router.get('/leaderboard', async (req, res, next) => {
  try {
    await ensureSchema();
    const sort  = VALID_SORTS.has(req.query.sort) ? req.query.sort : 'winrate';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    const rowsRaw = await sql`
      SELECT
        u.id,
        u.username,
        COUNT(m.id)::int                                          AS games,
        SUM(CASE WHEN m.result = 'win'  THEN 1 ELSE 0 END)::int   AS wins,
        SUM(CASE WHEN m.result = 'loss' THEN 1 ELSE 0 END)::int   AS losses,
        SUM(CASE WHEN m.result = 'draw' THEN 1 ELSE 0 END)::int   AS draws
      FROM users u
      JOIN matches m ON m.user_id = u.id
      GROUP BY u.id, u.username
      HAVING COUNT(m.id) >= 3
    `;

    const rows = rowsRaw.map(r => ({
      user_id: r.id,
      username: r.username,
      games: r.games,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      win_rate: r.games > 0 ? r.wins / r.games : 0
    }));

    rows.sort((a, b) => {
      if (sort === 'winrate'){
        if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
        return b.games - a.games;
      }
      if (sort === 'wins'){
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.win_rate - a.win_rate;
      }
      if (b.games !== a.games) return b.games - a.games;
      return b.wins - a.wins;
    });

    res.json({ sort, entries: rows.slice(0, limit) });
  } catch (e){ next(e); }
});

export default router;
