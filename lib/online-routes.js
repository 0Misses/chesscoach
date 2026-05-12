// Online multiplayer: user search, challenges, live games, polling endpoints.
//
// Real-time strategy
// ------------------
// Spec asks for Socket.IO. We deploy on Vercel Functions (serverless), which
// terminate after each request — no persistent process to hold WebSocket state.
// Socket.IO would need a separate long-running host. To keep the project on one
// platform we use the spec's stated fallback: short-interval HTTP polling
// (2s on the client). The endpoints below are designed so a Socket.IO layer
// could be added later without changing the data model.
import { Router } from 'express';
import { Chess } from 'chess.js';
import { sql, ensureSchema } from './db.js';
import { requireAuth } from './middleware.js';

const router = Router();

// Online window: user counts as "online" if heartbeat in last 30s.
const ONLINE_WINDOW_SEC = 30;

// ---- heartbeat: bump last_seen so other users see this one as online ----
router.post('/online/heartbeat', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    await sql`UPDATE users SET last_seen = NOW() WHERE id = ${req.user.id}`;
    res.json({ ok: true });
  } catch (e){ next(e); }
});

// ---- search users by username (prefix, case-insensitive) ----
router.get('/users/search', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const q = String(req.query.username || '').trim();
    if (q.length < 1){
      return res.json({ users: [] });
    }
    if (q.length > 32){
      return res.status(400).json({ error: 'Query too long' });
    }
    // Bump my own last_seen on each search so I stay "online" for others.
    await sql`UPDATE users SET last_seen = NOW() WHERE id = ${req.user.id}`;

    const like = q.toLowerCase() + '%';
    const rows = await sql`
      SELECT id, username, last_seen
      FROM users
      WHERE LOWER(username) LIKE ${like}
        AND id <> ${req.user.id}
      ORDER BY username ASC
      LIMIT 20
    `;
    const now = Date.now();
    const users = rows.map(r => ({
      id: r.id,
      username: r.username,
      online: r.last_seen ? (now - new Date(r.last_seen).getTime()) / 1000 < ONLINE_WINDOW_SEC : false
    }));
    res.json({ users });
  } catch (e){ next(e); }
});

// ---- send a challenge ----
router.post('/challenges', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const { challenged_id, challenged_username } = req.body || {};
    let targetId = Number.isInteger(challenged_id) ? challenged_id : null;

    if (!targetId && typeof challenged_username === 'string'){
      const r = await sql`SELECT id FROM users WHERE LOWER(username) = LOWER(${challenged_username}) LIMIT 1`;
      if (!r.length) return res.status(404).json({ error: 'User not found' });
      targetId = r[0].id;
    }
    if (!targetId)               return res.status(400).json({ error: 'challenged_id or challenged_username required' });
    if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot challenge yourself' });

    // Block duplicate pending challenges between the same pair (either direction).
    const dup = await sql`
      SELECT id FROM challenges
      WHERE status = 'pending'
        AND ((challenger_id = ${req.user.id} AND challenged_id = ${targetId})
          OR (challenger_id = ${targetId}     AND challenged_id = ${req.user.id}))
      LIMIT 1
    `;
    if (dup.length){
      return res.status(409).json({ error: 'A pending challenge already exists between you two' });
    }

    const ins = await sql`
      INSERT INTO challenges (challenger_id, challenged_id)
      VALUES (${req.user.id}, ${targetId})
      RETURNING id, challenger_id, challenged_id, status, created_at
    `;
    res.status(201).json({ challenge: ins[0] });
  } catch (e){ next(e); }
});

// ---- incoming challenges for me (pending) ----
router.get('/challenges/incoming', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT c.id, c.challenger_id, c.challenged_id, c.status, c.created_at, u.username AS challenger_username
      FROM challenges c
      JOIN users u ON u.id = c.challenger_id
      WHERE c.challenged_id = ${req.user.id} AND c.status = 'pending'
      ORDER BY c.created_at DESC
      LIMIT 50
    `;
    res.json({ challenges: rows });
  } catch (e){ next(e); }
});

// ---- outgoing — useful for the challenger to detect accept/decline ----
router.get('/challenges/outgoing', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT c.id, c.challenger_id, c.challenged_id, c.status, c.game_id, c.created_at, c.updated_at,
             u.username AS challenged_username
      FROM challenges c
      JOIN users u ON u.id = c.challenged_id
      WHERE c.challenger_id = ${req.user.id}
        AND c.created_at > NOW() - INTERVAL '1 hour'
      ORDER BY c.created_at DESC
      LIMIT 50
    `;
    res.json({ challenges: rows });
  } catch (e){ next(e); }
});

// ---- accept: creates a game, returns game_id ----
router.post('/challenges/:id/accept', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad challenge id' });

    const rows = await sql`SELECT * FROM challenges WHERE id = ${id} LIMIT 1`;
    if (!rows.length)                            return res.status(404).json({ error: 'Challenge not found' });
    const ch = rows[0];
    if (ch.challenged_id !== req.user.id)        return res.status(403).json({ error: 'Not your challenge' });
    if (ch.status !== 'pending')                 return res.status(409).json({ error: `Challenge already ${ch.status}` });

    // Random colors. Challenger has a 50/50 of getting white.
    const challengerIsWhite = Math.random() < 0.5;
    const whiteId = challengerIsWhite ? ch.challenger_id : ch.challenged_id;
    const blackId = challengerIsWhite ? ch.challenged_id : ch.challenger_id;

    const startFen = new Chess().fen();
    const gameRows = await sql`
      INSERT INTO games (white_player_id, black_player_id, fen, turn, status)
      VALUES (${whiteId}, ${blackId}, ${startFen}, 'w', 'active')
      RETURNING id
    `;
    const gameId = gameRows[0].id;

    await sql`
      UPDATE challenges SET status = 'accepted', game_id = ${gameId}, updated_at = NOW()
      WHERE id = ${id}
    `;
    res.json({ ok: true, game_id: gameId });
  } catch (e){ next(e); }
});

// ---- decline ----
router.post('/challenges/:id/decline', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad challenge id' });

    const rows = await sql`SELECT * FROM challenges WHERE id = ${id} LIMIT 1`;
    if (!rows.length)                     return res.status(404).json({ error: 'Challenge not found' });
    const ch = rows[0];
    if (ch.challenged_id !== req.user.id) return res.status(403).json({ error: 'Not your challenge' });
    if (ch.status !== 'pending')          return res.status(409).json({ error: `Challenge already ${ch.status}` });

    await sql`UPDATE challenges SET status = 'declined', updated_at = NOW() WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (e){ next(e); }
});

// ---- cancel my own pending outgoing challenge ----
router.post('/challenges/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad challenge id' });
    const rows = await sql`SELECT * FROM challenges WHERE id = ${id} LIMIT 1`;
    if (!rows.length)                     return res.status(404).json({ error: 'Challenge not found' });
    const ch = rows[0];
    if (ch.challenger_id !== req.user.id) return res.status(403).json({ error: 'Not your challenge' });
    if (ch.status !== 'pending')          return res.status(409).json({ error: `Challenge already ${ch.status}` });
    await sql`UPDATE challenges SET status = 'cancelled', updated_at = NOW() WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (e){ next(e); }
});

// ---- list my recent games (active + finished) ----
// Keep this literal route before /games/:id so Express does not treat
// "mine" as a game id.
router.get('/games/mine/recent', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const rows = await sql`
      SELECT g.id, g.status, g.turn, g.winner_id, g.num_moves, g.updated_at,
             g.white_player_id, g.black_player_id,
             w.username AS white_username, b.username AS black_username
      FROM games g
      JOIN users w ON w.id = g.white_player_id
      JOIN users b ON b.id = g.black_player_id
      WHERE g.white_player_id = ${req.user.id} OR g.black_player_id = ${req.user.id}
      ORDER BY g.updated_at DESC
      LIMIT 20
    `;
    res.json({ games: rows });
  } catch (e){ next(e); }
});

// ---- game state ----
// Returns full game info plus all moves. The "version" field is num_moves —
// the client polls this and only re-renders when it changes.
router.get('/games/:id', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad game id' });

    const rows = await sql`
      SELECT g.*, w.username AS white_username, b.username AS black_username,
             win.username AS winner_username
      FROM games g
      JOIN users w   ON w.id = g.white_player_id
      JOIN users b   ON b.id = g.black_player_id
      LEFT JOIN users win ON win.id = g.winner_id
      WHERE g.id = ${id}
      LIMIT 1
    `;
    if (!rows.length) return res.status(404).json({ error: 'Game not found' });
    const g = rows[0];
    if (g.white_player_id !== req.user.id && g.black_player_id !== req.user.id){
      return res.status(403).json({ error: 'Not a player in this game' });
    }
    const moves = await sql`
      SELECT id, player_id, from_square, to_square, promotion, san, move_number, fen_after, created_at
      FROM moves WHERE game_id = ${id}
      ORDER BY move_number ASC
    `;
    res.json({
      game: {
        id: g.id,
        white_player_id: g.white_player_id,
        black_player_id: g.black_player_id,
        white_username:  g.white_username,
        black_username:  g.black_username,
        fen: g.fen,
        turn: g.turn,
        status: g.status,
        winner_id: g.winner_id,
        winner_username: g.winner_username,
        ending_type: g.ending_type,
        num_moves: g.num_moves,
        version:   g.num_moves,   // alias used by client polling
        created_at: g.created_at,
        updated_at: g.updated_at
      },
      moves
    });
  } catch (e){ next(e); }
});

// ---- submit a move ----
// Server is authoritative: load FEN, attempt the move via chess.js, persist
// new FEN + the move row, detect end-of-game and stamp status/winner.
router.post('/games/:id/move', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad game id' });

    const { from, to, promotion } = req.body || {};
    if (typeof from !== 'string' || typeof to !== 'string'){
      return res.status(400).json({ error: 'from and to are required' });
    }

    const rows = await sql`SELECT * FROM games WHERE id = ${id} LIMIT 1`;
    if (!rows.length)          return res.status(404).json({ error: 'Game not found' });
    const g = rows[0];
    if (g.status !== 'active') return res.status(409).json({ error: `Game already ${g.status}` });

    const playerColor =
      g.white_player_id === req.user.id ? 'w' :
      g.black_player_id === req.user.id ? 'b' : null;
    if (!playerColor)          return res.status(403).json({ error: 'Not a player in this game' });
    if (playerColor !== g.turn) return res.status(409).json({ error: 'Not your turn' });

    const chess = new Chess(g.fen);
    let moveObj;
    try {
      moveObj = chess.move({ from, to, promotion: promotion || 'q' });
    } catch (_){
      moveObj = null;
    }
    if (!moveObj) return res.status(400).json({ error: 'Illegal move' });

    const newFen = chess.fen();
    const nextTurn = chess.turn();
    const newCount = g.num_moves + 1;

    // Detect terminal state.
    let status = 'active', endingType = null, winnerId = null;
    if (chess.isCheckmate()){
      status = 'checkmate'; endingType = 'checkmate';
      // The side to move (nextTurn) has been mated — the OTHER side wins.
      winnerId = nextTurn === 'w' ? g.black_player_id : g.white_player_id;
    } else if (chess.isStalemate()){
      status = 'stalemate'; endingType = 'stalemate';
    } else if (chess.isThreefoldRepetition() || chess.isInsufficientMaterial() || chess.isDraw()){
      status = 'draw';
      endingType = chess.isThreefoldRepetition() ? 'threefold' :
                   chess.isInsufficientMaterial() ? 'insufficient' : 'draw';
    }

    await sql`
      INSERT INTO moves (game_id, player_id, from_square, to_square, promotion, san, move_number, fen_after)
      VALUES (${id}, ${req.user.id}, ${moveObj.from}, ${moveObj.to},
              ${moveObj.promotion || null}, ${moveObj.san}, ${newCount}, ${newFen})
    `;
    await sql`
      UPDATE games
      SET fen = ${newFen}, turn = ${nextTurn}, status = ${status},
          ending_type = ${endingType}, winner_id = ${winnerId},
          num_moves = ${newCount}, updated_at = NOW()
      WHERE id = ${id}
    `;
    res.json({
      ok: true,
      fen: newFen,
      turn: nextTurn,
      status,
      ending_type: endingType,
      winner_id: winnerId,
      move: moveObj,
      version: newCount
    });
  } catch (e){ next(e); }
});

// ---- resign ----
router.post('/games/:id/resign', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad game id' });

    const rows = await sql`SELECT * FROM games WHERE id = ${id} LIMIT 1`;
    if (!rows.length)          return res.status(404).json({ error: 'Game not found' });
    const g = rows[0];
    if (g.status !== 'active') return res.status(409).json({ error: `Game already ${g.status}` });
    const isWhite = g.white_player_id === req.user.id;
    const isBlack = g.black_player_id === req.user.id;
    if (!isWhite && !isBlack)  return res.status(403).json({ error: 'Not a player in this game' });

    const winnerId = isWhite ? g.black_player_id : g.white_player_id;
    await sql`
      UPDATE games
      SET status = 'resigned', ending_type = 'resignation',
          winner_id = ${winnerId}, updated_at = NOW()
      WHERE id = ${id}
    `;
    res.json({ ok: true, winner_id: winnerId });
  } catch (e){ next(e); }
});

export default router;
