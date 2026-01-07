# Supabase Database Setup Guide

This guide will walk you through setting up the Supabase database for Hearth.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create a new project
4. Note down your project URL and API keys

## 2. Configure Environment Variables

1. Copy `.env.example` to `.env`
2. Fill in your Supabase credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here
JWT_SECRET=generate_a_random_secret_here
```

3. In Netlify dashboard, add these as environment variables under Site Settings > Environment Variables

## 3. Create Database Tables

Run these SQL commands in the Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  hearth_key VARCHAR(20) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  privacy_settings JSONB DEFAULT '{
    "discoverable": false,
    "readReceipts": false,
    "jobVisibility": "private",
    "locationVisibility": "private",
    "relationshipVisibility": "private",
    "cloudBackup": false
  }'::jsonb
);

-- Pulses table
CREATE TABLE pulses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'inner_circle', 'all_kin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Acknowledgments table (tracks who acknowledged which pulse)
CREATE TABLE pulse_acknowledgments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pulse_id UUID REFERENCES pulses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pulse_id, user_id)
);

-- Kin relationships table (mutual connections)
CREATE TABLE kin_relationships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  kin_id UUID REFERENCES users(id) ON DELETE CASCADE,
  relationship_tier VARCHAR(20) DEFAULT 'kin' CHECK (relationship_tier IN ('inner_circle', 'kin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, kin_id),
  CHECK (user_id != kin_id)
);

-- Parlors (conversation rooms)
CREATE TABLE parlors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parlor participants
CREATE TABLE parlor_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parlor_id UUID REFERENCES parlors(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(parlor_id, user_id)
);

-- Parlor messages
CREATE TABLE parlor_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  parlor_id UUID REFERENCES parlors(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  media_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table
CREATE TABLE events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  host_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  guest_list_visible BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Event invites
CREATE TABLE event_invites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rsvp_status VARCHAR(20) DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'yes', 'no', 'maybe')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);
```

## 4. Set Up Row Level Security (RLS)

Enable RLS for privacy:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kin_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE parlors ENABLE ROW LEVEL SECURITY;
ALTER TABLE parlor_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE parlor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;

-- Users: Can read own profile, update own settings
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Pulses: Can create own, read Kin's based on visibility
CREATE POLICY "Users can create own pulses" ON pulses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read Kin pulses" ON pulses
  FOR SELECT USING (
    user_id = auth.uid() OR
    (visibility = 'all_kin' AND EXISTS (
      SELECT 1 FROM kin_relationships 
      WHERE (user_id = pulses.user_id AND kin_id = auth.uid())
         OR (kin_id = pulses.user_id AND user_id = auth.uid())
    )) OR
    (visibility = 'inner_circle' AND EXISTS (
      SELECT 1 FROM kin_relationships 
      WHERE (user_id = pulses.user_id AND kin_id = auth.uid() AND relationship_tier = 'inner_circle')
         OR (kin_id = pulses.user_id AND user_id = auth.uid() AND relationship_tier = 'inner_circle')
    ))
  );

-- Add more RLS policies as needed for other tables...
```

## 5. Create Indexes for Performance

```sql
-- Indexes for common queries
CREATE INDEX idx_pulses_user_id ON pulses(user_id);
CREATE INDEX idx_pulses_created_at ON pulses(created_at DESC);
CREATE INDEX idx_kin_relationships_user_id ON kin_relationships(user_id);
CREATE INDEX idx_kin_relationships_kin_id ON kin_relationships(kin_id);
CREATE INDEX idx_users_hearth_key ON users(hearth_key);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_parlor_messages_parlor_id ON parlor_messages(parlor_id);
CREATE INDEX idx_event_invites_user_id ON event_invites(user_id);
```

## 6. Test the Setup

Once the tables are created, you can test the connection:

1. In your local environment, ensure `.env` is properly configured
2. The Netlify Functions (when implemented) will use these tables
3. For now, the app uses localStorage for authentication and data

## 7. Next Steps - Implementing Netlify Functions

After database setup, create these Netlify Functions:

- `auth.js` - User registration and login
- `pulse-feed.js` - Fetch and create pulses
- `kin-management.js` - Manage relationships
- `parlor.js` - Messaging operations
- `events.js` - Event management

Each function will use the Supabase client to interact with the database.

## Security Notes

- **Never commit `.env` to Git** - it's in `.gitignore`
- Use environment variables in Netlify for production
- Service key should only be used in backend functions, never exposed to client
- RLS policies ensure users can only access data they're permitted to see
