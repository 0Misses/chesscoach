// Register / login / me. Postgres + bcrypt + JWT.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql, ensureSchema } from './db.js';
import { requireAuth } from './middleware.js';

const router = Router();
const BCRYPT_COST = 10;
const JWT_TTL = '7d';
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function signToken(user){
  return jwt.sign(
    { sub: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: JWT_TTL }
  );
}

router.post('/register', async (req, res, next) => {
  try {
    await ensureSchema();
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string'){
      return res.status(400).json({ error: 'username and password are required' });
    }
    if (!USERNAME_RE.test(username)){
      return res.status(400).json({ error: 'Username must be 3-20 characters, letters/digits/underscore only' });
    }
    if (password.length < 6 || password.length > 100){
      return res.status(400).json({ error: 'Password must be 6-100 characters' });
    }

    // Case-insensitive existence check — matches the unique LOWER(username) index.
    const existing = await sql`SELECT id FROM users WHERE LOWER(username) = LOWER(${username}) LIMIT 1`;
    if (existing.length){
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const rows = await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${username}, ${hash})
      RETURNING id, username
    `;
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user });
  } catch (e){ next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    await ensureSchema();
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string'){
      return res.status(400).json({ error: 'username and password are required' });
    }
    const rows = await sql`
      SELECT id, username, password_hash FROM users
      WHERE LOWER(username) = LOWER(${username}) LIMIT 1
    `;
    if (!rows.length){
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok){
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = { id: rows[0].id, username: rows[0].username };
    res.json({ token: signToken(user), user });
  } catch (e){ next(e); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    await ensureSchema();
    const rows = await sql`SELECT id, username, created_at FROM users WHERE id = ${req.user.id}`;
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (e){ next(e); }
});

export default router;
