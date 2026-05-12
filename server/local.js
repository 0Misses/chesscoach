// Local dev entry. Run with: npm run dev (from project root).
// Reads .env.local (pulled from Vercel) so it hits the same Neon DB.
import { config } from 'dotenv';
config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

const { createApp } = await import('../lib/app.js');

const app = createApp();
const PORT = parseInt(process.env.PORT, 10) || 3001;
app.listen(PORT, () => console.log(`AR Chess local server on :${PORT}`));
