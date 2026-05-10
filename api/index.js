// Vercel function entrypoint. Vercel routes /api/* here (see vercel.json).
import { createApp } from '../lib/app.js';

const app = createApp();
export default app;
