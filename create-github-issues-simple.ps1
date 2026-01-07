# Simplified GitHub Issues Creation Script for Hearth
# This version creates issues WITHOUT labels (since they need to be created first)

$REPO = "torpisoul/hearth-social"

Write-Host "Creating GitHub issues for Hearth project..." -ForegroundColor Cyan
Write-Host "Repository: $REPO" -ForegroundColor Yellow
Write-Host ""

# HIGH PRIORITY - Supabase Integration

gh issue create --repo $REPO `
    --title "[HIGH] Setup Supabase Database Schema" `
    --body @"
## Priority: HIGH

## Description
Set up the Supabase PostgreSQL database with all required tables for Hearth.

## Tasks
- [ ] Create Supabase project
- [ ] Run SQL schema from SUPABASE_SETUP.md
- [ ] Create tables: users, pulses, pulse_acknowledgments, kin_relationships
- [ ] Create tables: parlors, parlor_participants, parlor_messages
- [ ] Create tables: events, event_invites
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Create RLS policies for privacy enforcement
- [ ] Create indexes for performance
- [ ] Test database connection

## Acceptance Criteria
- All tables created successfully
- RLS policies prevent unauthorized access
- Database credentials stored in Netlify environment variables

## Reference
See SUPABASE_SETUP.md for complete SQL schema.
"@

gh issue create --repo $REPO `
    --title "[HIGH] Build Netlify Functions for Authentication" `
    --body @"
## Priority: HIGH

## Description
Create Netlify Functions to handle user authentication with Supabase.

## Tasks
- [ ] Create functions/auth.js for login/register
- [ ] Implement JWT token generation
- [ ] Add password hashing (bcrypt)
- [ ] Create user registration endpoint
- [ ] Create user login endpoint
- [ ] Handle Hearth Key generation
- [ ] Validate email/password requirements
- [ ] Return user object with privacy settings

## API Endpoints
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout

## Acceptance Criteria
- Users can register with email/password
- Login returns valid JWT token
- Hearth Key is unique and generated correctly
- Passwords are securely hashed
"@

gh issue create --repo $REPO `
    --title "[HIGH] Build Netlify Functions for Pulse Feed" `
    --body @"
## Priority: HIGH

## Description  
Create Netlify Functions to manage Pulse updates (CRUD operations).

## Tasks
- [ ] Create functions/pulse-feed.js
- [ ] Implement GET /api/pulse (fetch user's feed)
- [ ] Implement POST /api/pulse (create new pulse)
- [ ] Implement POST /api/pulse/:id/acknowledge
- [ ] Filter pulses based on visibility settings
- [ ] Query Kin relationships to determine visible pulses  
- [ ] Return pulses in chronological order

## Acceptance Criteria
- Feed shows only pulses user has permission to see
- Visibility rules enforced (Private, Inner Circle, All Kin)
- Acknowledgments are tracked per user
"@

gh issue create --repo $REPO `
    --title "[HIGH] Build Netlify Functions for Parlor (Messaging)" `
    --body @"
## Priority: HIGH

## Description
Create Netlify Functions for Parlor messaging operations.

## Tasks
- [ ] Create functions/parlor.js
- [ ] Implement GET /api/conversations
- [ ] Implement POST /api/conversations
- [ ] Implement GET /api/conversations/:id/messages
- [ ] Implement POST /api/conversations/:id/messages
- [ ] Handle media upload to cloud storage
- [ ] Set media expiration timestamps

## Acceptance Criteria
- Messages only visible to conversation participants
- Media uploads work with expiration
- Quiet Mode respected (no push notifications by default)
"@

gh issue create --repo $REPO `
    --title "[HIGH] Build Netlify Functions for Events" `
    --body @"
## Priority: HIGH

## Description
Create Netlify Functions for event management (Notice Board).

## Tasks
- [ ] Create functions/events.js
- [ ] Implement GET /api/events
- [ ] Implement POST /api/events
- [ ] Implement POST /api/events/:id/rsvp
- [ ] Filter guest list based on visibility settings
- [ ] Only show events user is invited to

## Acceptance Criteria
- Users only see events they're invited to
- Host can see all RSVPs
- Guest list respects visibility setting
"@

gh issue create --repo $REPO `
    --title "[HIGH] Build Netlify Functions for Kin Management" `
    --body @"
## Priority: HIGH

## Description
Create Netlify Functions to manage Kin relationships.

## Tasks
- [ ] Create functions/kin-management.js
- [ ] Implement POST /api/kin/request
- [ ] Implement POST /api/kin/accept
- [ ] Implement DELETE /api/kin/:id
- [ ] Implement PATCH /api/kin/:id/tier (change to Inner Circle)
- [ ] Ensure mutual relationship (both sides)

## Acceptance Criteria
- Kin requests require mutual acceptance
- Removing Kin deletes relationship for both users
- Inner Circle designation affects content visibility
"@

# MEDIUM PRIORITY - UI Enhancements

gh issue create --repo $REPO `
    --title "[MEDIUM] Implement QR Code for Hearth Key Sharing" `
    --body @"
## Priority: MEDIUM

## Description
Add QR code generation for easy Hearth Key sharing in person.

## Tasks
- [ ] Add qrcode.js library to project
- [ ] Update shareHearthKey() in profile.js
- [ ] Generate QR code containing user's Hearth Key
- [ ] Display in existing QR modal
- [ ] Add 'Download QR Code' button

## Implementation
See FUTURE_FEATURES.md for code examples.

Library: qrcodejs

## Acceptance Criteria
- QR code displays user's Hearth Key
- Code is scannable and readable
- Modal design matches neumorphic aesthetic
"@

gh issue create --repo $REPO `
    --title "[MEDIUM] Implement Custom Sunset Timer Hours" `
    --body @"
## Priority: MEDIUM

## Description
Allow users to set custom start/end times for Sunset Timer.

## Tasks
- [ ] Add time input fields to Profile settings
- [ ] Save custom hours to localStorage
- [ ] Update checkAndApplySunsetTimer() in app.js
- [ ] Handle midnight-crossing ranges (e.g., 10 PM - 6 AM)

## Implementation
See FUTURE_FEATURES.md for code examples.

## Acceptance Criteria
- Users can set any start/end time
- Timer activates correctly during set hours
- Midnight crossing works properly
"@

gh issue create --repo $REPO `
    --title "[MEDIUM] Wire Up Remove Kin and Message Kin Buttons" `
    --body @"
## Priority: MEDIUM

## Description
Add functionality to existing 'Remove' and 'Message' buttons on Kin cards.

## Tasks
- [ ] Add click handler for 'Message' button (navigate to Parlor)
- [ ] Add click handler for 'Remove' button (with confirmation)
- [ ] Add 'Change Tier' functionality (Kin ↔ Inner Circle)

## Implementation
See FUTURE_FEATURES.md for code examples.

## Acceptance Criteria
- 'Message' button opens Parlor conversation
- 'Remove' button shows confirmation and removes Kin
- Changes persist to database
"@

gh issue create --repo $REPO `
    --title "[MEDIUM] Add Media Expiration in Parlor" `
    --body @"
## Priority: MEDIUM

## Description
Implement auto-expiring media in Parlor messages for privacy.

## Tasks
- [ ] Add expiration time selector when uploading
- [ ] Options: 1 hour, 24 hours, 7 days, Never
- [ ] Store mediaExpiresAt timestamp with messages
- [ ] Check expiration when rendering messages
- [ ] Show 'Media expired' placeholder for expired content

## Acceptance Criteria
- User can choose expiration time
- Expired media shows placeholder
- Default is 24 hours
"@

gh issue create --repo $REPO `
    --title "[MEDIUM] Improve Mobile Responsiveness" `
    --body @"
## Priority: MEDIUM

## Description
Audit and improve mobile experience across all pages.

## Tasks
- [ ] Test all pages on mobile viewport (320px - 768px)
- [ ] Fix any overflow or layout issues
- [ ] Ensure touch targets are at least 44px
- [ ] Test modals on mobile (scrollable)
- [ ] Optimize font sizes

## Pages to Test
Landing, Onboarding, Pulse, Parlor, Notice Board, Profile

## Acceptance Criteria
- All pages render correctly on mobile
- No horizontal scrolling
- All elements easily tappable
"@

# LOW PRIORITY - Testing & Docs

gh issue create --repo $REPO `
    --title "[LOW] Write Unit Tests for Core Functions" `
    --body @"
## Priority: LOW

## Description
Add unit tests for critical JavaScript functions.

## Tasks
- [ ] Choose testing framework (Jest/Vitest/Mocha)
- [ ] Set up test environment
- [ ] Write tests for pulse.js functions
- [ ] Write tests for parlor.js functions
- [ ] Write tests for profile.js functions
- [ ] Add CI/CD pipeline to run tests

## Acceptance Criteria
- At least 60% code coverage
- All critical paths tested
- Tests pass in CI/CD
"@

gh issue create --repo $REPO `
    --title "[LOW] Create User Documentation" `
    --body @"
## Priority: LOW

## Description
Create user-facing documentation explaining Hearth's features.

## Tasks
- [ ] Create docs/ folder
- [ ] Write 'Getting Started' guide
- [ ] Document privacy controls
- [ ] Explain Hearth Key system
- [ ] Document Pulse visibility settings
- [ ] Create FAQ page

## Acceptance Criteria
- Clear, concise documentation
- Screenshots illustrate key concepts
- Accessible from within the app
"@

gh issue create --repo $REPO `
    --title "[LOW] Set Up Continuous Deployment Pipeline" `
    --body @"
## Priority: LOW

## Description
Automate deployment to Netlify on merge to main branch.

## Tasks
- [ ] Configure Netlify build settings
- [ ] Set up environment variables in Netlify
- [ ] Create deployment preview for PRs
- [ ] Configure custom domain (if applicable)
- [ ] Set up SSL certificate

## Acceptance Criteria
- Merges to main trigger automatic deploys
- PRs generate preview deployments
- SSL works correctly
"@

# FUTURE/BACKLOG

gh issue create --repo $REPO `
    --title "[FUTURE] Implement Contact Discovery System" `
    --body @"
## Priority: FUTURE/BACKLOG

## Description
Allow users to find Kin from phone contacts (opt-in).

## Tasks
- [ ] Create UI for contact upload
- [ ] Hash phone numbers client-side
- [ ] Build Netlify Function to accept hashed contacts
- [ ] Match against other users
- [ ] Show 'People You May Know'

## Privacy Considerations
- Hash phone numbers before upload
- Never store plain-text numbers
- Explicit opt-in required
- Clear data deletion option

See FUTURE_FEATURES.md for full details.
"@

gh issue create --repo $REPO `
    --title "[FUTURE] Add Push Notifications (Opt-In)" `
    --body @"
## Priority: FUTURE/BACKLOG

## Description
Implement opt-in push notifications for important events.

## Notification Types
- New Kin request
- Event RSVP changes
- Upcoming events (24h before)

## Privacy
- Must be opt-in (default OFF)
- Respect Quiet Mode
- Honor 'Do Not Disturb' hours

See FUTURE_FEATURES.md for details.
"@

gh issue create --repo $REPO `
    --title "[FUTURE] Implement PWA Features" `
    --body @"
## Priority: FUTURE/BACKLOG

## Description
Convert Hearth to a Progressive Web App.

## Tasks
- [ ] Create manifest.json
- [ ] Add app icons (various sizes)
- [ ] Implement service worker
- [ ] Cache static assets
- [ ] Add 'Add to Home Screen' prompt

## Acceptance Criteria
- App can be installed from browser
- Works offline for basic functionality
- Passes Lighthouse PWA audit
"@

Write-Host ""
Write-Host "✅ All GitHub issues created successfully!" -ForegroundColor Green
Write-Host "Check your repository: https://github.com/$REPO/issues" -ForegroundColor Cyan
