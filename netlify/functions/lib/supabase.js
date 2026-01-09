
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  // In development/test without envs, we might not want to throw immediately if we are mocking
  // But for production, this is critical.
  console.warn('Supabase URL or Service Key missing!');
}

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://example.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'example-key'
);

module.exports = supabase;
