// Register / login / me. Passwords are bcrypted, never returned.
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { stmts } from './db.js';
import { requireAuth } from './middleware.js';

const router = Router();
const BCRYPT_COST = 10;
const JWT_TTL = '7d';

// Username: 3-20 chars, letters/digits/underscore. Password: 6-100 chars.
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: JWT_TTL }
  );
}

router.post('/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username and password are required' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({
      error: 'Username must be 3-20 characters, letters/digits/underscore only'
    });
  }
  if (password.length < 6 || password.length > 100) {
    return res.status(400).json({ error: 'Password must be 6-100 characters' });
  }

  const existing = stmts.findUserByUsername.get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const info = stmts.insertUser.run(username, hash);
  const user = { id: info.lastInsertRowid, username };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'username and password are required' });
  }
  const row = stmts.findUserByUsername.get(username);
  if (!row) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const user = { id: row.id, username: row.username };
  const token = signToken(user);
  res.json({ token, user });
});

router.get('/me', requireAuth, (req, res) => {
  const row = stmts.findUserById.get(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json({ user: row });
});

export default router;
