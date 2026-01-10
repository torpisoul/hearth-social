import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  const mdPath = path.join(__dirname, '..', 'SUPABASE_SETUP.md');
  const mdContent = fs.readFileSync(mdPath, 'utf8');

  // Extract SQL blocks
  const sqlBlocks = [];
  const regex = /```sql([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(mdContent)) !== null) {
    sqlBlocks.push(match[1].trim());
  }

  if (sqlBlocks.length === 0) {
    console.error('No SQL blocks found in SUPABASE_SETUP.md');
    process.exit(1);
  }

  // If we are running in a test environment (e.g. pg-mem), we skip the real connection
  if (process.env.TEST_MODE === 'true') {
    console.log('Running in TEST_MODE, skipping real DB connection.');
    return sqlBlocks;
  }

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL is not defined in .env');
    console.error('Please add your Supabase connection string to .env file.');
    console.error('Example: DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Supabase requires SSL
    // Force IPv4 to avoid IPv6 DNS issues
    options: '-c search_path=public',
  });

  try {
    await client.connect();
    console.log('Connected to database...');

    for (const sql of sqlBlocks) {
      console.log('Executing SQL block...');
      // Split by semicolon to handle multiple statements in one block if necessary,
      // but usually pg handles it. However, some extensions or specific commands might need separation.
      // For now, let's try sending the whole block.
      await client.query(sql);
      console.log('Block executed successfully.');
    }

    console.log('Database setup complete!');
  } catch (err) {
    console.error('Error executing SQL:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Export for testing
export { setupDatabase };

// Run if called directly (ES module compatible check)
if (import.meta.url.startsWith('file:')) {
  const modulePath = fileURLToPath(import.meta.url);
  const scriptPath = process.argv[1];

  if (modulePath === scriptPath || path.resolve(modulePath) === path.resolve(scriptPath)) {
    setupDatabase();
  }
}

