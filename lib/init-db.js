// Standalone schema init. Run with: npm run init-db
// Loads .env.local before importing db.js so the connection string is available.
import { config } from 'dotenv';

config({ path: '.env.local', override: false });
config({ path: '.env', override: false });

const { initSchema } = await import('./db.js');

initSchema()
  .then(() => { console.log('Schema initialized.'); process.exit(0); })
  .catch((err) => { console.error(err); process.exit(1); });
