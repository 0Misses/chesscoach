// Public leaderboard. No auth required so anyone can browse it.
import { Router } from 'express';
import { stmts } from './db.js';

const router = Router();

const VALID_SORTS = new Set(['winrate', 'wins', 'games']);

router.get('/leaderboard', (req, res) => {
  const sort = VALID_SORTS.has(req.query.sort) ? req.query.sort : 'winrate';
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

  const rows = stmts.leaderboardAll.all().map(r => ({
    user_id: r.id,
    username: r.username,
    games: r.games,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    win_rate: r.games > 0 ? r.wins / r.games : 0
  }));

  rows.sort((a, b) => {
    if (sort === 'winrate') {
      // Tie-break by games played so a 100% / 3 games user doesn't outrank a 95% / 50.
      if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate;
      return b.games - a.games;
    }
    if (sort === 'wins') {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.win_rate - a.win_rate;
    }
    // games
    if (b.games !== a.games) return b.games - a.games;
    return b.wins - a.wins;
  });

  res.json({ sort, entries: rows.slice(0, limit) });
});

export default router;
