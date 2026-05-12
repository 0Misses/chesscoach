// Express app — used by both api/index.js (Vercel function) and server/local.js (local dev).
import express from 'express';
import cors from 'cors';
import authRoutes from './auth-routes.js';
import matchRoutes from './match-routes.js';
import leaderboardRoutes from './leaderboard.js';
import onlineRoutes from './online-routes.js';

export function createApp(){
  if (!process.env.JWT_SECRET){
    throw new Error('JWT_SECRET is not set.');
  }

  const app = express();

  // Same-origin in production (frontend + backend on the same Vercel domain),
  // so CORS only matters for local dev or stand-alone hosting. Keep permissive.
  const allowed = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    }
  }));

  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api', authRoutes);
  app.use('/api', matchRoutes);
  app.use('/api', leaderboardRoutes);
  app.use('/api', onlineRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal error' });
  });

  return app;
}
