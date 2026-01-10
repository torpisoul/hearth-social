import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabaseViaAPI() {
    // Read SQL from SUPABASE_SETUP.md
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

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env');
        process.exit(1);
    }

    // Create Supabase client with service key
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );

    try {
        console.log('Setting up database via Supabase API...');

        // Execute each SQL block using Supabase's RPC or direct SQL execution
        for (const sql of sqlBlocks) {
            console.log('Executing SQL block...');

            // Use Supabase's SQL execution endpoint
            const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

            if (error) {
                // If exec_sql doesn't exist, we need to run this manually in Supabase SQL Editor
                console.error('Note: Direct SQL execution via API requires a custom RPC function.');
                console.error('Please run the SQL commands manually in Supabase SQL Editor:');
                console.error('1. Go to https://supabase.com/dashboard/project/eevsfnauvmboroikbxkn/sql');
                console.error('2. Copy the SQL from SUPABASE_SETUP.md');
                console.error('3. Run each SQL block in the editor');
                process.exit(1);
            }

            console.log('Block executed successfully.');
        }

        console.log('Database setup complete!');
    } catch (err) {
        console.error('Error:', err);
        console.error('\nAlternative: Run the SQL manually in Supabase SQL Editor');
        console.error('Visit: https://supabase.com/dashboard/project/eevsfnauvmboroikbxkn/sql');
        process.exit(1);
    }
}

// Run the setup
setupDatabaseViaAPI();
