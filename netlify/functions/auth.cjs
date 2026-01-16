const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

// Helper to generate a unique Hearth Key
const generateHearthKey = () => {
  // Requirement: VARCHAR(20) UNIQUE.
  // Format: HEARTH-XXXX-XXXX (16 chars)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments = [];
  for (let i = 0; i < 2; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return `HEARTH-${segments.join('-')}`;
};

// Main logic decoupled from handler
const authLogic = async (event, supabase) => {
  const path = event.path || '';
  const method = event.httpMethod;
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    if (path.endsWith('/register') && method === 'POST') {
      const { email, password, displayName, hearthKey: providedHearthKey, privacySettings } = JSON.parse(event.body);

      // Validation
      if (!email || !password || !displayName) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email, password, and display name are required' })
        };
      }

      if (password.length < 8) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Password must be at least 8 characters long' })
        };
      }

      // Check if user exists
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email already registered' })
        };
      }

      // Use provided key or generate new one
      const hearthKey = providedHearthKey || generateHearthKey();

      // Use provided privacy settings or default
      const finalPrivacySettings = privacySettings || {
          discoverable: false,
          readReceipts: false,
          jobVisibility: "private",
          locationVisibility: "private",
          relationshipVisibility: "private",
          cloudBackup: false
      };

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            email,
            password_hash: passwordHash,
            display_name: displayName,
            hearth_key: hearthKey,
            privacy_settings: finalPrivacySettings
          }
        ])
        .select()
        .single();

      if (createError) {
        console.error('Create User Error:', createError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: `Failed to create user: ${createError.message} - ${createError.details || ''}` })
        };
      }

      // Generate token
      const token = jwt.sign(
        { userId: newUser.id, email: newUser.email, hearthKey: newUser.hearth_key },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          user: {
            id: newUser.id,
            email: newUser.email,
            displayName: newUser.display_name,
            hearthKey: newUser.hearth_key,
            privacySettings: newUser.privacy_settings
          },
          token
        })
      };

    } else if (path.endsWith('/login') && method === 'POST') {
      const { email, password } = JSON.parse(event.body);

      if (!email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email and password are required' })
        };
      }

      // Find user
      const { data: user, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (findError || !user) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid email or password' })
        };
      }

      // Check password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid email or password' })
        };
      }

      // Generate token
      const token = jwt.sign(
        { userId: user.id, email: user.email, hearthKey: user.hearth_key },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            displayName: user.display_name,
            hearthKey: user.hearth_key,
            privacySettings: user.privacy_settings
          },
          token
        })
      };

    } else if (path.endsWith('/logout') && method === 'POST') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Logged out successfully' })
      };
    } else if (path.endsWith('/user') && method === 'PATCH') {
      // Verify token
      const authHeader = event.headers.authorization || event.headers.Authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Missing or invalid authorization header' })
        };
      }

      const token = authHeader.split(' ')[1];
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      } catch (err) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid token' })
        };
      }

      const { displayName, privacySettings } = JSON.parse(event.body);
      const updates = {};
      if (displayName) updates.display_name = displayName;
      if (privacySettings) updates.privacy_settings = privacySettings;

      if (Object.keys(updates).length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No updates provided' })
        };
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('id', decoded.userId)
        .select()
        .single();

      if (updateError) {
        console.error('Update User Error:', updateError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to update user' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            displayName: updatedUser.display_name,
            hearthKey: updatedUser.hearth_key,
            privacySettings: updatedUser.privacy_settings
          }
        })
      };

    } else if (path.endsWith('/reset-password-request') && method === 'POST') {
      const { email } = JSON.parse(event.body);

      if (!email) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email is required' })
        };
      }

      const { data: user, error: findError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .single();

      if (!user) {
        // Return success even if user not found to prevent enumeration
        console.log(`Password reset requested for non-existent email: ${email}`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'If that email exists, a reset link has been sent.' })
        };
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, purpose: 'reset-password' },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1h' }
      );

      // Construct link
      const origin = event.headers.origin || `https://${event.headers.host}`;
      const resetLink = `${origin}/reset-password.html?token=${token}`;

      console.log(`Password Reset Link for ${email}: ${resetLink}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            message: 'If that email exists, a reset link has been sent.',
            debugLink: resetLink // For development convenience
        })
      };

    } else if (path.endsWith('/reset-password') && method === 'POST') {
      const { token, newPassword } = JSON.parse(event.body);

      if (!token || !newPassword) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Token and new password are required' })
        };
      }

      if (newPassword.length < 8) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Password must be at least 8 characters long' })
        };
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        if (decoded.purpose !== 'reset-password') {
            throw new Error('Invalid token purpose');
        }
      } catch (err) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid or expired token' })
        };
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: passwordHash })
        .eq('id', decoded.userId);

      if (updateError) {
        console.error('Reset Password Error:', updateError);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to reset password' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Password reset successfully' })
      };

    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Not Found' })
      };
    }
  } catch (error) {
    console.error('Auth Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Internal Server Error: ${error.message}` })
    };
  }
};

exports.authLogic = authLogic;

exports.handler = async (event, context) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase Configuration');
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Configuration Error: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' })
        };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        return await authLogic(event, supabase);
    } catch (err) {
        console.error('Supabase Initialization Error:', err);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: `Initialization Error: ${err.message}` })
        };
    }
};
