const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Only allow POST, DELETE, PATCH requests
  if (!['POST', 'DELETE', 'PATCH'].includes(event.httpMethod)) {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Initialize Supabase client
  // We use the anon key but pass the user's JWT for authentication/RLS context
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { statusCode: 500, body: 'Missing Supabase configuration' };
  }

  // Helper to get authenticated user
  const getAuthUser = async (token) => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: token } },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { user, supabase };
  };

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return { statusCode: 401, body: 'Unauthorized: Missing token' };
  }

  const auth = await getAuthUser(authHeader);
  if (!auth) {
    return { statusCode: 401, body: 'Unauthorized: Invalid token' };
  }
  const { user, supabase: userSupabase } = auth;
  const userId = user.id;

  // Determine action based on path
  // path could be /.netlify/functions/kin-management/request or /api/kin/request
  // We look at the end of the path
  const path = event.path;

  try {
    // POST /api/kin/request
    if (event.httpMethod === 'POST' && path.endsWith('/request')) {
      const { target_user_id } = JSON.parse(event.body);
      if (!target_user_id) {
        return { statusCode: 400, body: 'Missing target_user_id' };
      }
      if (target_user_id === userId) {
        return { statusCode: 400, body: 'Cannot send request to self' };
      }

      // Check if relationship already exists
      const { data: existingRel } = await userSupabase
        .from('kin_relationships')
        .select('id')
        .match({ user_id: userId, kin_id: target_user_id })
        .single();

      if (existingRel) {
         return { statusCode: 400, body: 'Relationship already exists' };
      }

      // Check if request already exists (sent by me)
      const { data: existingReq } = await userSupabase
        .from('kin_requests')
        .select('id')
        .match({ sender_id: userId, receiver_id: target_user_id })
        .single();

      if (existingReq) {
        return { statusCode: 400, body: 'Request already pending' };
      }

      // Check if request already exists (received from them) - if so, auto-accept?
      // Requirement says "Kin requests require mutual acceptance".
      // Usually if A requests B and B has already requested A, we can treat it as accept.
      // But let's stick to explicit accept for now, or just inform user.
      const { data: incomingReq } = await userSupabase
        .from('kin_requests')
        .select('id')
        .match({ sender_id: target_user_id, receiver_id: userId })
        .single();

      if (incomingReq) {
         return { statusCode: 400, body: 'Incoming request already exists. Please accept it.' };
      }

      // Create request
      const { error } = await userSupabase
        .from('kin_requests')
        .insert({ sender_id: userId, receiver_id: target_user_id });

      if (error) throw error;

      return { statusCode: 200, body: JSON.stringify({ message: 'Request sent' }) };
    }

    // POST /api/kin/accept
    if (event.httpMethod === 'POST' && path.endsWith('/accept')) {
      // Body can contain request_id OR target_user_id.
      // Let's support target_user_id as it's more robust if UI doesn't have request_id handy.
      const { target_user_id } = JSON.parse(event.body);
      if (!target_user_id) {
        return { statusCode: 400, body: 'Missing target_user_id' };
      }

      // Find the request
      const { data: request, error: fetchError } = await userSupabase
        .from('kin_requests')
        .select('id')
        .match({ sender_id: target_user_id, receiver_id: userId, status: 'pending' })
        .single();

      if (fetchError || !request) {
        return { statusCode: 404, body: 'No pending request found from this user' };
      }

      // Use Service Role to ensure atomicity and mutual creation if RLS blocks creation for others
      // Although usually users can only insert their own rows.
      // Inserting A->B is fine for A (me). Inserting B->A (them->me) might be blocked by RLS if policy says "auth.uid() = user_id".
      // Current RLS policy in SUPABASE_SETUP.md isn't fully defined for kin_relationships insert.
      // We will use Service Key to ensure both rows are created.

      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

      // Transaction-like operations
      // 1. Insert A->B and B->A
      const { error: insertError } = await adminSupabase
        .from('kin_relationships')
        .insert([
          { user_id: userId, kin_id: target_user_id, relationship_tier: 'kin' },
          { user_id: target_user_id, kin_id: userId, relationship_tier: 'kin' }
        ]);

      if (insertError) {
        // If unique constraint fails, maybe they are already kin.
        console.error('Insert error:', insertError);
        return { statusCode: 500, body: 'Failed to create relationship' };
      }

      // 2. Delete request
      const { error: deleteError } = await adminSupabase
        .from('kin_requests')
        .delete()
        .eq('id', request.id);

      if (deleteError) {
         console.error('Delete request error:', deleteError);
         // Relationship created but request not deleted. Not ideal but acceptable.
      }

      return { statusCode: 200, body: JSON.stringify({ message: 'Request accepted' }) };
    }

    // DELETE /api/kin/:id
    // regex to capture ID at the end
    const deleteMatch = path.match(/\/api\/kin\/([a-zA-Z0-9-]+)$/) || path.match(/\/kin-management\/([a-zA-Z0-9-]+)$/);
    if (event.httpMethod === 'DELETE' && deleteMatch) {
      const targetUserId = deleteMatch[1];

      // Use Service Role to delete BOTH sides
      const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error } = await adminSupabase
        .from('kin_relationships')
        .delete()
        .or(`and(user_id.eq.${userId},kin_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},kin_id.eq.${userId})`);

      if (error) throw error;

      return { statusCode: 200, body: JSON.stringify({ message: 'Relationship removed' }) };
    }

    // PATCH /api/kin/:id/tier
    const patchMatch = path.match(/\/api\/kin\/([a-zA-Z0-9-]+)\/tier$/) || path.match(/\/kin-management\/([a-zA-Z0-9-]+)\/tier$/);
    if (event.httpMethod === 'PATCH' && patchMatch) {
      const targetUserId = patchMatch[1];
      const { tier } = JSON.parse(event.body);

      if (!['inner_circle', 'kin'].includes(tier)) {
        return { statusCode: 400, body: 'Invalid tier. Must be inner_circle or kin' };
      }

      // Update ONLY my side of the relationship
      const { error } = await userSupabase
        .from('kin_relationships')
        .update({ relationship_tier: tier })
        .match({ user_id: userId, kin_id: targetUserId });

      if (error) throw error;

      return { statusCode: 200, body: JSON.stringify({ message: 'Tier updated' }) };
    }

    return { statusCode: 404, body: 'Not Found' };

  } catch (err) {
    console.error('Error processing request:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
