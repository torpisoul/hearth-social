const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
// We use the Service Key to perform admin tasks if necessary,
// but we should be careful with RLS.
// In the context of the feed, we might need to query data across users
// to construct the feed based on complex visibility rules that RLS might restrict
// if we were just using the anon key with a user token.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = { supabase };
