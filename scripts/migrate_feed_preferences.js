import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateFeedPreferences() {
  if (process.env.TEST_MODE === 'true') {
    console.log('Running in TEST_MODE, skipping real DB connection.');
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL is not defined in .env');
    console.error('Please add your Supabase connection string to .env file.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    options: '-c search_path=public',
  });

  try {
    await client.connect();
    console.log('Connected to database...');

    console.log('Adding feed_preferences column to users table...');
    const sql = `
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS feed_preferences JSONB DEFAULT '[]';
    `;

    await client.query(sql);
    console.log('Migration executed successfully.');

  } catch (err) {
    console.error('Error executing SQL:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
if (import.meta.url.startsWith('file:')) {
  const modulePath = fileURLToPath(import.meta.url);
  const scriptPath = process.argv[1];

  if (modulePath === scriptPath || path.resolve(modulePath) === path.resolve(scriptPath)) {
    migrateFeedPreferences();
  }
}
