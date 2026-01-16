const { supabase } = require('./utils/supabase');

exports.handler = async (event, context) => {
  console.log(`Request: ${event.httpMethod} ${event.path}`);

  // Extract user_id from headers (simulated auth)
  // In a real app, this would come from a JWT token
  const userId = event.headers['x-user-id'] || event.headers['X-User-Id'];

  if (!userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: Missing User ID' }),
    };
  }

  try {
    if (event.httpMethod === 'GET') {
      return await handleGetFeed(userId);
    } else if (event.httpMethod === 'POST') {
      // Check if it's an acknowledgment
      if (event.path.includes('/acknowledge')) {
        // Extract Pulse ID from path: /api/pulse/{id}/acknowledge
        // Since we redirect /api/pulse/* to this function, the event.path will be preserved as the original path
        // e.g., /api/pulse/123-abc/acknowledge
        const parts = event.path.split('/');
        const pulseIndex = parts.indexOf('pulse');
        if (pulseIndex !== -1 && parts[pulseIndex + 2] === 'acknowledge') {
          const pulseId = parts[pulseIndex + 1];
          return await handleAcknowledge(userId, pulseId);
        }
      }

      // Otherwise, it's a create pulse request
      return await handleCreatePulse(userId, event.body);
    } else {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
      };
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message }),
    };
  }
};

async function handleGetFeed(userId) {
  // 1. Get Kin relationships to determine visibility
  // Find all users who are kin with the current user
  const { data: kinData, error: kinError } = await supabase
    .from('kin_relationships')
    .select('kin_id, relationship_tier')
    .eq('user_id', userId);

  if (kinError) throw kinError;

  // Map kin by ID and tier for easy lookup
  const kinMap = {};
  const allKinIds = [];
  kinData.forEach(k => {
    kinMap[k.kin_id] = k.relationship_tier;
    allKinIds.push(k.kin_id);
  });

  // 2. Fetch pulses
  // We need to fetch pulses from:
  // - The user themselves
  // - Kin (if visibility is 'all_kin' or 'inner_circle' and they are inner circle)

  // Since Supabase filtering with complex OR conditions across relations can be tricky,
  // we will fetch candidate pulses and filter them.
  // A more optimized SQL query or RPC function would be better for scale,
  // but for now we'll do it in code or simple query.

  // Candidate authors: User + All Kin
  const authorsToFetch = [userId, ...allKinIds];

  const { data: pulses, error: pulseError } = await supabase
    .from('pulses')
    .select(`
      id,
      user_id,
      content,
      visibility,
      category,
      created_at,
      users (
        display_name,
        avatar_url
      )
    `)
    .in('user_id', authorsToFetch)
    .order('created_at', { ascending: false })
    .limit(50); // Pagination could be added later

  if (pulseError) throw pulseError;

  // 3. Filter pulses based on visibility
  const visiblePulses = pulses.filter(pulse => {
    // Always show own pulses
    if (pulse.user_id === userId) return true;

    // Pulse is from a Kin
    const relationshipTier = kinMap[pulse.user_id];

    // If no relationship (shouldn't happen given the query, but safe check), hide
    if (!relationshipTier) return false;

    // Visibility Logic:
    // 'private': Only author sees it (handled by first check)
    if (pulse.visibility === 'private') return false;

    // 'all_kin': Visible to all kin
    if (pulse.visibility === 'all_kin') return true; // Since we only fetched from Kin list

    // 'inner_circle': Visible only if relationship is inner_circle
    if (pulse.visibility === 'inner_circle') {
      return relationshipTier === 'inner_circle';
    }

    return false;
  });

  // 4. Fetch acknowledgments for these pulses to see if current user acknowledged them
  const pulseIds = visiblePulses.map(p => p.id);
  let acknowledgedSet = new Set();

  if (pulseIds.length > 0) {
    const { data: acks, error: ackError } = await supabase
      .from('pulse_acknowledgments')
      .select('pulse_id')
      .eq('user_id', userId)
      .in('pulse_id', pulseIds);

    if (ackError) throw ackError;

    acks.forEach(a => acknowledgedSet.add(a.pulse_id));
  }

  // 5. Format response
  const feed = visiblePulses.map(pulse => ({
    id: pulse.id,
    author: pulse.users ? pulse.users.display_name : 'Unknown',
    authorId: pulse.user_id,
    authorAvatar: pulse.users ? pulse.users.avatar_url : null,
    content: pulse.content,
    visibility: pulse.visibility,
    category: pulse.category,
    timestamp: pulse.created_at, // Client expects timestamp, send ISO string
    isAcknowledged: acknowledgedSet.has(pulse.id)
  }));

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feed),
  };
}

async function handleCreatePulse(userId, body) {
  const { content, visibility, category } = JSON.parse(body);

  if (!content) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Content is required' }),
    };
  }

  const validVisibilities = ['private', 'inner_circle', 'all_kin'];
  const vis = validVisibilities.includes(visibility) ? visibility : 'private';

  const { data, error } = await supabase
    .from('pulses')
    .insert([
      { user_id: userId, content, visibility: vis, category }
    ])
    .select()
    .single();

  if (error) throw error;

  return {
    statusCode: 201,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

async function handleAcknowledge(userId, pulseId) {
  // Check if already acknowledged
  const { data: existing, error: fetchError } = await supabase
    .from('pulse_acknowledgments')
    .select('id')
    .eq('pulse_id', pulseId)
    .eq('user_id', userId)
    .single(); // single() returns error if no rows or multiple rows

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "JSON object requested, multiple (or no) rows returned"
    throw fetchError;
  }

  if (existing) {
    // Toggle off (Un-acknowledge) - Optional based on requirements, but good UX
    // But requirement says "Acknowledgments are tracked per user", implies adding.
    // Usually a toggle is expected. Let's implementing toggle.
    const { error: deleteError } = await supabase
      .from('pulse_acknowledgments')
      .delete()
      .eq('id', existing.id);

    if (deleteError) throw deleteError;

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Acknowledgment removed', acknowledged: false }),
    };
  } else {
    // Add acknowledgment
    const { error: insertError } = await supabase
      .from('pulse_acknowledgments')
      .insert([
        { pulse_id: pulseId, user_id: userId }
      ]);

    if (insertError) throw insertError;

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Pulse acknowledged', acknowledged: true }),
    };
  }
}
