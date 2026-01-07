# Hearth 🌿

**Your Digital Living Room** - A privacy-first social platform built on intentionality, consent, and calm.

---

## Philosophy

Hearth rejects the attention economy. Instead of chasing engagement and harvesting data, we create a warm, grounded space for genuine human connection.

### The Three Golden Rules

1. **🔒 Consent by Default** - Everything is private until you explicitly choose to share
2. **📅 Linearity over Algorithms** - Chronological feeds with clear endpoints ("You're all caught up")
3. **🏠 Zero External Interop** - No sharing outside Hearth, no third-party logins

### Language Matters

- **Kin** not "Followers" - Mutual, meaningful connections
- **Acknowledged** or **Heartfelt** not "Likes" - Genuine responses
- **Inner Circle** not "Close Friends" - Relationship tiers with explicit consent

---

## Features

### Phase 1 (Complete ✅)

- **The Pulse** - Share life updates with chronological, algorithm-free feed
- **Privacy Control Panel** - Granular settings for discoverability, read receipts, and life updates
- **Hearth Key System** - Unique identifier for finding Kin (no global search)
- **Sunset Timer** - Auto-dim during evening hours to encourage healthy usage
- **Neumorphic Design** - Soft, tactile UI with warm color palette

### Phase 2 (Complete ✅)

- **The Parlor** - Private messaging with Quiet Mode (notifications off by default)
- **The Notice Board** - Event creation with RSVP and guest list privacy controls
- **Enhanced Profile** - Life updates editor, Kin management, Dark Mode
- **Pulse → Parlor Integration** - Respond to pulses with 1-on-1 conversations

### Phase 3 (Planned)

- Supabase database integration
- Real-time subscriptions for messages and events
- QR code Hearth Key sharing
- Custom Sunset Timer hours
- Media expiration in Parlor

See [FUTURE_FEATURES.md](FUTURE_FEATURES.md) for detailed implementation plans.

---

## Tech Stack

- **Frontend:** Pure HTML/CSS/JavaScript (neumorphic design system)
- **Deployment:** Netlify (with Functions for backend)
- **Database:** Supabase (PostgreSQL with Row Level Security)
- **Storage:** Currently localStorage (migrating to Supabase)

---

## Getting Started

### Local Development

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Run dev server
netlify dev

# Open http://localhost:8888
```

### Environment Setup

When ready for production:

1. Copy `.env.example` to `.env`
2. Fill in Supabase credentials
3. See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for database schema

---

## Current Status

**Fully Functional MVP** with localStorage-based data persistence:

✅ All Phase 1 & 2 features working  
✅ Neumorphic design complete  
✅ Dark mode support  
✅ Responsive on all devices

**Ready for Supabase integration** to enable:
- Cross-device synchronization
- Real-time updates
- Proper authentication
- Production deployment

---

## Design System

**Color Palette:**
- Light Mode: Oatmeal, Sage Green, Soft Slate
- Dark Mode: Deep Charcoal, Midnight Moss, Warm Ebony

**Design Principles:**
- High-radius corners (30px+)
- Layered neumorphic shadows
- Slow, organic transitions (400-600ms)
- Inter font family

---

## Mental Health & Digital Wellness

Hearth is designed with mental health in mind:

- **No infinite scroll** - Clear "caught up" endpoints
- **Sunset Timer** - Encourages putting phone down in evening
- **Quiet Mode** - Notifications off by default
- **No public metrics** - No follower counts or view stats
- **Linearity** - No algorithmic manipulation

---

## License

MIT License

---

**Hearth is a living room, not a marketplace. A space for Kin, not followers. For connection, not consumption.** 🌿
