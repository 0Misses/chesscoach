// Entry point. Boots Express, wires routes, configures CORS, and listens.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './auth-routes.js';
import matchRoutes from './match-routes.js';
import leaderboardRoutes from './leaderboard.js';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = express();

// CORS allowlist. Comma-separated list in CORS_ORIGIN, or "*" for dev convenience.
const allowed = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Same-origin requests (curl, server-to-server) have no Origin header — allow.
    if (!origin) return cb(null, true);
    if (allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  }
}));

app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api', authRoutes);
app.use('/api', matchRoutes);
app.use('/api', leaderboardRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

const PORT = parseInt(process.env.PORT, 10) || 3001;
app.listen(PORT, () => {
  console.log(`AR Chess server listening on :${PORT}`);
  console.log(`CORS allowlist: ${allowed.length ? allowed.join(', ') : '(none — set CORS_ORIGIN)'}`);
});
