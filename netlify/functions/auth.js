const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Helper to generate a unique Hearth Key
const generateHearthKey = () => {
  // Generate a random string. For simplicity and readability, we can use a portion of a UUID
  // or a random alphanumeric string.
  // Requirement: VARCHAR(20) UNIQUE.
  // Let's generate a 12-char random string to be safe and short enough.
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
      const { email, password, displayName } = JSON.parse(event.body);

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

      // Generate Hearth Key
      let hearthKey = generateHearthKey();
      // Ideally we check uniqueness, but for simplicity we assume collision is rare enough
      // or DB will throw error and we catch it.
      // A retry loop could be added here.

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
            privacy_settings: {
                discoverable: false,
                readReceipts: false,
                jobVisibility: "private",
                locationVisibility: "private",
                relationshipVisibility: "private",
                cloudBackup: false
            }
          }
        ])
        .select()
        .single();

      if (createError) {
        console.error('Create User Error:', createError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to create user' })
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
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};

exports.authLogic = authLogic;

exports.handler = async (event, context) => {
  const supabase = require('./lib/supabase');
  return authLogic(event, supabase);
};
