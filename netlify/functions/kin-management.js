const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
  // Only allow GET, POST, DELETE, PATCH requests
  if (!['GET', 'POST', 'DELETE', 'PATCH'].includes(event.httpMethod)) {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const jwtSecret = process.env.JWT_SECRET || 'secret';

  if (!supabaseUrl || !supabaseServiceKey) {
    return { statusCode: 500, body: 'Missing Supabase configuration' };
  }

  // Use Service Key to bypass RLS since we are using custom JWTs
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Verify Token
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return { statusCode: 401, body: 'Unauthorized: Missing token' };
  }

  const token = authHeader.replace('Bearer ', '');
  let user;
  try {
    user = jwt.verify(token, jwtSecret);
  } catch (err) {
    return { statusCode: 401, body: 'Unauthorized: Invalid token' };
  }

  const userId = user.userId;
  const path = event.path;

  try {
    // GET /api/kin - List all Kin
    // matches /api/kin or /.netlify/functions/kin-management
    // Check if it's the root path (list)
    const isRoot = path.endsWith('/kin-management') || path.endsWith('/api/kin');

    if (event.httpMethod === 'GET' && isRoot) {
      const { data: kinList, error } = await supabase
        .from('kin_relationships')
        .select(`
          id,
          kin_id,
          relationship_tier,
          created_at,
          kin:kin_id (
            id,
            display_name,
            hearth_key,
            avatar_url
          )
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('Fetch kin error:', error);
        throw error;
      }

      // Transform data for frontend
      const formattedList = kinList.map(item => ({
        id: item.kin.id, // We use the user_id of the kin as the ID for actions
        relationshipId: item.id,
        displayName: item.kin.display_name,
        hearthKey: item.kin.hearth_key,
        avatarUrl: item.kin.avatar_url,
        tier: item.relationship_tier,
        createdAt: item.created_at
      }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedList)
      };
    }

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
      const { data: existingRel } = await supabase
        .from('kin_relationships')
        .select('id')
        .match({ user_id: userId, kin_id: target_user_id })
        .single();

      if (existingRel) {
         return { statusCode: 400, body: 'Relationship already exists' };
      }

      // Check if request already exists (sent by me)
      const { data: existingReq } = await supabase
        .from('kin_requests')
        .select('id')
        .match({ sender_id: userId, receiver_id: target_user_id })
        .single();

      if (existingReq) {
        return { statusCode: 400, body: 'Request already pending' };
      }

      // Check incoming
      const { data: incomingReq } = await supabase
        .from('kin_requests')
        .select('id')
        .match({ sender_id: target_user_id, receiver_id: userId })
        .single();

      if (incomingReq) {
         return { statusCode: 400, body: 'Incoming request already exists. Please accept it.' };
      }

      // Create request
      const { error } = await supabase
        .from('kin_requests')
        .insert({ sender_id: userId, receiver_id: target_user_id });

      if (error) throw error;

      return { statusCode: 200, body: JSON.stringify({ message: 'Request sent' }) };
    }

    // POST /api/kin/accept
    if (event.httpMethod === 'POST' && path.endsWith('/accept')) {
      const { target_user_id } = JSON.parse(event.body);
      if (!target_user_id) {
        return { statusCode: 400, body: 'Missing target_user_id' };
      }

      // Find the request
      const { data: request, error: fetchError } = await supabase
        .from('kin_requests')
        .select('id')
        .match({ sender_id: target_user_id, receiver_id: userId, status: 'pending' })
        .single();

      if (fetchError || !request) {
        return { statusCode: 404, body: 'No pending request found from this user' };
      }

      // 1. Insert A->B and B->A
      const { error: insertError } = await supabase
        .from('kin_relationships')
        .insert([
          { user_id: userId, kin_id: target_user_id, relationship_tier: 'kin' },
          { user_id: target_user_id, kin_id: userId, relationship_tier: 'kin' }
        ]);

      if (insertError) {
        console.error('Insert error:', insertError);
        return { statusCode: 500, body: 'Failed to create relationship' };
      }

      // 2. Delete request
      const { error: deleteError } = await supabase
        .from('kin_requests')
        .delete()
        .eq('id', request.id);

      if (deleteError) {
         console.error('Delete request error:', deleteError);
      }

      return { statusCode: 200, body: JSON.stringify({ message: 'Request accepted' }) };
    }

    // DELETE /api/kin/:id
    const deleteMatch = path.match(/\/api\/kin\/([a-zA-Z0-9-]+)$/) || path.match(/\/kin-management\/([a-zA-Z0-9-]+)$/);
    if (event.httpMethod === 'DELETE' && deleteMatch) {
      const targetUserId = deleteMatch[1];

      // Delete BOTH sides of the relationship
      // Since we are using Service Key, we can delete both
      const { error } = await supabase
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
      const { error } = await supabase
        .from('kin_relationships')
        .update({ relationship_tier: tier })
        .match({ user_id: userId, kin_id: targetUserId });

      if (error) throw error;

      return { statusCode: 200, body: JSON.stringify({ message: 'Tier updated' }) };
    }

    return { statusCode: 404, body: 'Not Found' };

  } catch (err) {
    console.error('Error processing request:', err);
    return { statusCode: 500, body: 'Internal Server Error: ' + err.message };
  }
};
