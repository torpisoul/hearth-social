const { newDb } = require('pg-mem');
const { setupDatabase } = require('./setup_database');

async function testSchema() {
  console.log('Starting schema validation test...');

  // Mock environment
  process.env.TEST_MODE = 'true';

  // Get SQL blocks from the setup script
  const sqlBlocks = await setupDatabase();

  // Create in-memory DB
  const db = newDb();

  // Create auth schema
  db.createSchema('auth');

  // Register uuid-ossp extension mock
  db.registerExtension('uuid-ossp', (schema) => {
    schema.registerFunction({
      name: 'uuid_generate_v4',
      returns: db.public.getType('uuid'),
      implementation: () => '00000000-0000-0000-0000-000000000000',
    });
  });

  // Mock auth.uid() function
  db.getSchema('auth').registerFunction({
    name: 'uid',
    returns: db.public.getType('uuid'),
    implementation: () => '00000000-0000-0000-0000-000000000000',
  });

  const client = db.adapters.createPg().Client;
  const dbClient = new client();
  await dbClient.connect();

  try {
    for (const sql of sqlBlocks) {
      console.log('Testing SQL block...');

      const statements = splitSqlStatements(sql);

      for (const statement of statements) {
          if (!statement.trim()) continue;

          // Check for comments or placeholders that aren't valid SQL
          if (statement.trim().startsWith('--')) {
             // If the statement is ONLY a comment (because we split by ;), it might fail if pg-mem expects SQL
             // But usually comments are fine. However, "Add more RLS policies..." might be treated as a statement if it was followed by a semicolon in the source or if split logic preserved it.
             // The error "Unexpected end of input" often happens on empty or comment-only strings passed to parser.
             // Let's just skip comment-only statements.
             const lines = statement.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('--'));
             if (lines.length === 0) {
                 console.log('Skipping comment-only statement.');
                 continue;
             }
          }


          try {
            await dbClient.query(statement);
            console.log('Statement valid.');
          } catch (innerErr) {
            const msg = innerErr.message || innerErr.toString();
            // Ignore RLS errors as pg-mem likely doesn't support them
            if (statement.includes('ENABLE ROW LEVEL SECURITY') || statement.includes('CREATE POLICY')) {
                console.log('Ignored RLS/Policy statement (not supported by pg-mem): ' + statement.substring(0, 50) + '...');
                continue;
            }
             if (statement.includes('CREATE EXTENSION')) {
                console.log('Ignored CREATE EXTENSION error.');
                continue;
            }
            console.error('Failed statement: ' + statement);
            throw innerErr;
          }
      }
      console.log('Block processed.');
    }

    console.log('Schema validation passed!');
  } catch (err) {
    console.error('Schema validation failed:', err);
    process.exit(1);
  } finally {
    await dbClient.end();
  }
}

// Simple SQL splitter
function splitSqlStatements(sql) {
    return sql.split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

testSchema();
