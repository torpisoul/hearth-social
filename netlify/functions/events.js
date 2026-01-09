const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const { httpMethod, headers, body, path } = event;

  // Initialize Supabase
  // In production, use process.env.SUPABASE_URL and process.env.SUPABASE_ANON_KEY
  // For local testing without env vars, we might need a fallback or mock logic,
  // but standard practice is to rely on env vars.
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error: Missing Database Credentials' }),
    };
  }

  // Extract Auth Token
  const authHeader = headers['authorization'] || headers['Authorization'];
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (!token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: No token provided' }),
    };
  }

  // Create Supabase client with user context
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Verify User
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    console.error('Auth error:', authError);
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized: Invalid token' }),
    };
  }

  const userId = user.id;

  // Router Logic
  // Paths:
  // GET /api/events
  // POST /api/events
  // POST /api/events/:id/rsvp

  // Clean path to handle potential prefixes like /.netlify/functions
  // We look for the segment after 'events'
  const pathSegments = path.split('/').filter(p => p.length > 0);
  const eventsIndex = pathSegments.indexOf('events');

  // If 'events' is not found, something is wrong with routing
  if (eventsIndex === -1) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Not Found' }) };
  }

  const resourceId = pathSegments[eventsIndex + 1]; // :id
  const action = pathSegments[eventsIndex + 2]; // :rsvp

  try {
    if (httpMethod === 'GET' && !resourceId) {
      return await getEvents(supabase, userId);
    } else if (httpMethod === 'POST' && !resourceId) {
      return await createEvent(supabase, userId, body);
    } else if (httpMethod === 'POST' && resourceId && action === 'rsvp') {
      return await rsvpEvent(supabase, userId, resourceId, body);
    } else {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }
  } catch (err) {
    console.error('Handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) };
  }
};

async function getEvents(supabase, userId) {
  // Strategy:
  // 1. Fetch events hosted by user.
  // 2. Fetch events where user is invited.
  // 3. Combine and deduplicate.
  // Note: We need to fetch related invitees and host info.

  // Fetch events I host
  const { data: hostedEvents, error: hostError } = await supabase
    .from('events')
    .select(`
      *,
      host:host_id(id, display_name, avatar_url),
      event_invites(
        user_id,
        rsvp_status,
        updated_at,
        user:user_id(id, display_name, avatar_url)
      )
    `)
    .eq('host_id', userId);

  if (hostError) throw hostError;

  // Fetch events I am invited to
  // We use the inner join trick on event_invites to filter events
  const { data: invitedEvents, error: inviteError } = await supabase
    .from('events')
    .select(`
      *,
      host:host_id(id, display_name, avatar_url),
      event_invites!inner(
        user_id,
        rsvp_status,
        updated_at,
        user:user_id(id, display_name, avatar_url)
      )
    `)
    .eq('event_invites.user_id', userId);

  if (inviteError) throw inviteError;

  // Note: The invitedEvents query above only returns the specific invite for the user due to !inner filtering on that relation?
  // Actually, Supabase/PostgREST behavior with !inner filter: it filters the parent rows, but what about the nested resource collection?
  // Usually it returns only the matching rows in the nested resource if filtered there.
  // But we want ALL invites for that event to display the guest list (subject to visibility).
  // So we might need to fetch the full invite list for these events separately or construct the query differently.

  // A better approach might be: Get IDs of events I'm invited to, then fetch those events with full details.
  const eventIdsInvitedTo = invitedEvents.map(e => e.id);

  // Now fetch full details for these events (if not already covered by hostedEvents)
  // We need to exclude events we already have (hosted ones) to avoid double fetching, but deduping later is fine.

  let allEventIds = new Set([
    ...hostedEvents.map(e => e.id),
    ...eventIdsInvitedTo
  ]);

  if (allEventIds.size === 0) {
    return { statusCode: 200, body: JSON.stringify([]) };
  }

  const { data: allEvents, error: allEventsError } = await supabase
    .from('events')
    .select(`
      *,
      host:host_id(id, display_name, avatar_url),
      event_invites(
        user_id,
        rsvp_status,
        updated_at,
        user:user_id(id, display_name, avatar_url)
      )
    `)
    .in('id', Array.from(allEventIds))
    .order('event_date', { ascending: true });

  if (allEventsError) throw allEventsError;

  // Apply visibility rules
  const processedEvents = allEvents.map(event => {
    // If I am the host, I see everything.
    if (event.host_id === userId) {
      return event;
    }

    // If guest list is NOT visible, I only see myself and maybe the host (host is already in event.host)
    if (!event.guest_list_visible) {
      event.event_invites = event.event_invites.filter(inv => inv.user_id === userId);
    }

    // Flatten invite user details into the invite object for easier frontend consumption if needed,
    // but the query structure `user:user_id(...)` is standard.
    // The frontend expects:
    // invitees: [ { id, name, rsvp } ]
    // Let's transform to match frontend expectation if possible, or keep it as DB structure.
    // The frontend code I read uses: `invitees: [ { id: '...', name: '...', rsvp: '...' } ]`
    // So let's map it.

    event.invitees = event.event_invites.map(inv => ({
      id: inv.user_id,
      name: inv.user?.display_name || 'Unknown',
      rsvp: inv.rsvp_status,
      avatar_url: inv.user?.avatar_url
    }));

    // Add hostName for frontend compatibility
    event.hostName = event.host?.display_name || 'Unknown';
    // Add eventDate (it's already there as event_date, but frontend looks for eventDate camelCase?)
    // Frontend `notice-board.js` uses `event.eventDate` (camelCase) but DB has `event_date`.
    // Let's normalize.
    event.eventDate = event.event_date;
    event.guestListVisible = event.guest_list_visible;
    event.hostId = event.host_id;

    // Clean up DB keys if we want strictly what frontend uses, but keeping them doesn't hurt.
    // However, the `event_invites` field is replaced/augmented by `invitees`.
    delete event.event_invites;

    return event;
  });

  return {
    statusCode: 200,
    body: JSON.stringify(processedEvents),
  };
}

async function createEvent(supabase, userId, body) {
  const payload = JSON.parse(body);
  const { title, description, eventDate, location, guestListVisible, invitees } = payload;
  // invitees is array of user IDs.

  if (!title || !eventDate) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Insert Event
  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .insert({
      host_id: userId,
      title,
      description,
      event_date: eventDate, // Ensure this is ISO string or timestamp
      location,
      guest_list_visible: guestListVisible
    })
    .select()
    .single();

  if (eventError) throw eventError;

  const eventId = eventData.id;

  // Insert Invites
  // Include self? Usually host is implied, but maybe add as 'yes' or 'pending'?
  // Frontend `notice-board.js` logic showed `invitees` including current-user.
  // Let's add the host to invites as well with 'yes' status? Or rely on host_id.
  // The frontend sample data showed host in invitees list sometimes.
  // Let's stick to explicitly passed invitees + maybe host if not included.

  // We need to handle the invitees list.
  if (invitees && Array.isArray(invitees) && invitees.length > 0) {
    const invitesData = invitees.map(invId => ({
      event_id: eventId,
      user_id: invId,
      rsvp_status: 'pending'
    }));

    // Add host if not present?
    // If we want host to appear in the list with RSVP 'yes'
    if (!invitees.includes(userId)) {
        invitesData.push({
            event_id: eventId,
            user_id: userId,
            rsvp_status: 'yes' // Host is going
        });
    }

    const { error: inviteError } = await supabase
      .from('event_invites')
      .insert(invitesData);

    if (inviteError) {
      // Potentially rollback event creation?
      // For now, just report error.
      console.error('Error creating invites:', inviteError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Event created but invites failed' }) };
    }
  } else {
     // Just add host
     const { error: inviteError } = await supabase
      .from('event_invites')
      .insert({
          event_id: eventId,
          user_id: userId,
          rsvp_status: 'yes'
      });
      if (inviteError) throw inviteError;
  }

  return {
    statusCode: 201,
    body: JSON.stringify({ message: 'Event created', id: eventId }),
  };
}

async function rsvpEvent(supabase, userId, eventId, body) {
  const payload = JSON.parse(body);
  const { rsvp } = payload; // 'yes', 'no', 'maybe'

  if (!['yes', 'no', 'maybe'].includes(rsvp)) {
     return { statusCode: 400, body: JSON.stringify({ error: 'Invalid RSVP status' }) };
  }

  // Update invite
  // We need to upsert or update?
  // If user wasn't invited, can they RSVP?
  // "Users only see events they're invited to".
  // If they somehow got the link, maybe we allow it (open event?) but requirements say "invited to".
  // So we assume they have an invite row.

  const { data, error } = await supabase
    .from('event_invites')
    .update({ rsvp_status: rsvp, updated_at: new Date() })
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .select();

  if (error) throw error;

  if (data.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Invite not found' }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'RSVP updated' }),
  };
}
