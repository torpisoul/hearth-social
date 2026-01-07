# GitHub Issues Creation Script for Hearth
# Run this script to create all planned issues for the project
# Prerequisites: GitHub CLI installed (gh auth login)

# Set your repository (update if needed)
$REPO = "torpisoul/hearth-social"

Write-Host "Creating GitHub issues for Hearth project..." -ForegroundColor Cyan
Write-Host "Repository: $REPO" -ForegroundColor Yellow
Write-Host ""

# ============================================
# PHASE 3: SUPABASE INTEGRATION (High Priority)
# ============================================

Write-Host "Creating Supabase Integration issues..." -ForegroundColor Green

gh issue create --repo $REPO `
  --title "Setup Supabase Database Schema" `
  --label "enhancement,database,high-priority" `
  --milestone "Phase 3: Production Backend" `
  --body @"
## Description
Set up the Supabase PostgreSQL database with all required tables for Hearth.

## Tasks
- [ ] Create Supabase project
- [ ] Run SQL schema from [SUPABASE_SETUP.md](../blob/main/SUPABASE_SETUP.md)
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
See [SUPABASE_SETUP.md](../blob/main/SUPABASE_SETUP.md) for complete SQL schema.
"@

gh issue create --repo $REPO `
  --title "Build Netlify Functions for Authentication" `
  --label "enhancement,backend,high-priority" `
  --milestone "Phase 3: Production Backend" `
  --body @"
## Description
Create Netlify Functions to handle user authentication with Supabase.

## Tasks
- [ ] Create \`functions/auth.js\` for login/register
- [ ] Implement JWT token generation
- [ ] Add password hashing (bcrypt)
- [ ] Create user registration endpoint
- [ ] Create user login endpoint
- [ ] Handle Hearth Key generation
- [ ] Validate email/password requirements
- [ ] Return user object with privacy settings

## API Endpoints
\`\`\`
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
\`\`\`

## Acceptance Criteria
- Users can register with email/password
- Login returns valid JWT token
- Hearth Key is unique and generated correctly
- Passwords are securely hashed

## Security Notes
- Use SUPABASE_SERVICE_KEY (not anon key) in Functions
- Never expose JWT_SECRET to client
- Validate input to prevent SQL injection
"@

gh issue create --repo $REPO `
  --title "Build Netlify Functions for Pulse Feed" `
  --label "enhancement,backend,high-priority" `
  --milestone "Phase 3: Production Backend" `
  --body @"
## Description
Create Netlify Functions to manage Pulse updates (CRUD operations).

## Tasks
- [ ] Create \`functions/pulse-feed.js\`
- [ ] Implement GET /api/pulse (fetch user's feed)
- [ ] Implement POST /api/pulse (create new pulse)
- [ ] Implement POST /api/pulse/:id/acknowledge
- [ ] Filter pulses based on visibility settings
- [ ] Query Kin relationships to determine visible pulses
- [ ] Return pulses in chronological order

## API Endpoints
\`\`\`
GET    /api/pulse          # Get feed for authenticated user
POST   /api/pulse          # Create new pulse
POST   /api/pulse/:id/ack  # Acknowledge a pulse
\`\`\`

## Acceptance Criteria
- Feed shows only pulses user has permission to see
- Visibility rules enforced (Private, Inner Circle, All Kin)
- Acknowledgments are tracked per user

## Frontend Integration
- Replace \`loadPulses()\` in \`pulse.js\` to call API
- Replace \`createPulse()\` to POST to API
- Replace \`acknowledgePulse()\` to call API
"@

gh issue create --repo $REPO `
  --title "Build Netlify Functions for Parlor Messaging" `
  --label "enhancement,backend,medium-priority" `
  --milestone "Phase 3: Production Backend" `
  --body @"
## Description
Create Netlify Functions for Parlor (messaging) operations.

## Tasks
- [ ] Create \`functions/parlor.js\`
- [ ] Implement GET /api/conversations (list user's conversations)
- [ ] Implement POST /api/conversations (create new)
- [ ] Implement GET /api/conversations/:id/messages
- [ ] Implement POST /api/conversations/:id/messages (send message)
- [ ] Handle media upload to cloud storage
- [ ] Set media expiration timestamps

## API Endpoints
\`\`\`
GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/:id/messages
POST   /api/conversations/:id/messages
\`\`\`

## Acceptance Criteria
- Messages only visible to conversation participants
- Media uploads work with expiration
- Quiet Mode respected (no push notifications by default)

## Real-Time (Optional)
Consider Supabase Realtime subscriptions for live message delivery.
"@

gh issue create --repo $REPO `
  --title "Build Netlify Functions for Events (Notice Board)" `
  --label "enhancement,backend,medium-priority" `
  --milestone "Phase 3: Production Backend" `
  --body @"
## Description
Create Netlify Functions for event management.

## Tasks
- [ ] Create \`functions/events.js\`
- [ ] Implement GET /api/events (list user's events)
- [ ] Implement POST /api/events (create new event)
- [ ] Implement POST /api/events/:id/rsvp (update RSVP status)
- [ ] Filter guest list based on visibility settings
- [ ] Only show events user is invited to

## API Endpoints
\`\`\`
GET    /api/events
POST   /api/events
POST   /api/events/:id/rsvp
\`\`\`

## Acceptance Criteria
- Users only see events they're invited to
- Host can see all RSVPs
- Guest list respects visibility setting
- RSVP updates are saved correctly
"@

gh issue create --repo $REPO `
  --title "Build Netlify Functions for Kin Management" `
  --label "enhancement,backend,medium-priority" `
  --milestone "Phase 3: Production Backend" `
  --body @"
## Description
Create Netlify Functions to manage Kin relationships.

## Tasks
- [ ] Create \`functions/kin-management.js\`
- [ ] Implement POST /api/kin/request (send Kin request by Hearth Key)
- [ ] Implement POST /api/kin/accept (accept pending request)
- [ ] Implement DELETE /api/kin/:id (remove Kin)
- [ ] Implement PATCH /api/kin/:id/tier (change to Inner Circle)
- [ ] Ensure mutual relationship (both sides of connection)

## API Endpoints
\`\`\`
POST   /api/kin/request
POST   /api/kin/accept/:requestId
DELETE /api/kin/:kinId
PATCH  /api/kin/:kinId/tier
\`\`\`

## Acceptance Criteria
- Kin requests require mutual acceptance
- Removing Kin deletes relationship for both users
- Inner Circle designation affects content visibility
"@

# ============================================
# UI/UX ENHANCEMENTS (Medium Priority)
# ============================================

Write-Host "Creating UI/UX Enhancement issues..." -ForegroundColor Green

gh issue create --repo $REPO `
  --title "Implement QR Code for Hearth Key Sharing" `
  --label "feature,ui,good-first-issue" `
  --milestone "Phase 3: Production Backend" `
  --body @"
## Description
Add QR code generation for easy Hearth Key sharing in person.

## Tasks
- [ ] Add qrcode.js library to project
- [ ] Update \`shareHearthKey()\` in \`profile.js\`
- [ ] Generate QR code containing user's Hearth Key
- [ ] Display in existing QR modal
- [ ] Add "Download QR Code" button
- [ ] (Optional) Add QR scanner for adding Kin

## Implementation Guide
See [FUTURE_FEATURES.md](../blob/main/FUTURE_FEATURES.md#qr-code-sharing) for code examples.

## Library
\`\`\`html
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
\`\`\`

## Acceptance Criteria
- QR code displays user's Hearth Key
- Code is scannable and readable
- Modal design matches neumorphic aesthetic
"@

gh issue create --repo $REPO `
  --title "Implement Custom Sunset Timer Hours" `
  --label "feature,ui" `
  --body @"
## Description
Allow users to set custom start/end times for Sunset Timer instead of hardcoded 8 PM - 6 AM.

## Tasks
- [ ] Add time input fields to Profile settings
- [ ] Save custom hours to localStorage (sunsetStartHour, sunsetEndHour)
- [ ] Update \`checkAndApplySunsetTimer()\` in \`app.js\`
- [ ] Handle midnight-crossing ranges (e.g., 10 PM - 6 AM)
- [ ] Add UI to show current active hours

## Implementation Guide
See [FUTURE_FEATURES.md](../blob/main/FUTURE_FEATURES.md#customizable-sunset-timer-hours) for code examples.

## Acceptance Criteria
- Users can set any start/end time
- Timer activates correctly during set hours
- Midnight crossing works (e.g., 11 PM start, 5 AM end)
- Preferences persist across sessions
"@

gh issue create --repo $REPO `
  --title "Wire Up 'Remove Kin' and 'Message Kin' Buttons" `
  --label "feature,ui,good-first-issue" `
  --body @"
## Description
Add functionality to the existing "Remove" and "Message" buttons on Kin cards in Profile.

## Tasks
- [ ] Add click handler for "Message" button
  - Store context in sessionStorage
  - Navigate to Parlor
  - Open conversation with that Kin
- [ ] Add click handler for "Remove" button
  - Show confirmation dialog
  - Remove from UI
  - (After Supabase) Delete from database
- [ ] Add "Change Tier" functionality
  - Toggle between "Kin" and "Inner Circle"
  - Update badge display

## Implementation Guide
See [FUTURE_FEATURES.md](../blob/main/FUTURE_FEATURES.md#edit-kin-relationships) for code examples.

## Acceptance Criteria
- "Message" button opens Parlor conversation
- "Remove" button shows confirmation and removes Kin
- Changes persist (localStorage now, Supabase later)
"@

gh issue create --repo $REPO `
  --title "Add Media Expiration in Parlor Messages" `
  --label "feature,enhancement" `
  --body @"
## Description
Implement auto-expiring media in Parlor messages for privacy.

## Tasks
- [ ] Add expiration time selector when uploading media
  - Options: 1 hour, 24 hours, 7 days, Never
- [ ] Store \`mediaExpiresAt\` timestamp with messages
- [ ] Check expiration when rendering messages
- [ ] Show "Media expired" placeholder for expired content
- [ ] Add visual countdown/indicator for expiring soon

## Acceptance Criteria
- User can choose expiration time
- Expired media shows placeholder
- Default is 24 hours if not specified
- Works with both images and videos
"@

gh issue create --repo $REPO `
  --title "Improve Mobile Responsiveness" `
  --label "enhancement,ui,design" `
  --body @"
## Description
Audit and improve mobile experience across all pages.

## Tasks
- [ ] Test all pages on mobile viewport (320px - 768px)
- [ ] Fix any overflow or layout issues
- [ ] Ensure touch targets are at least 44px
- [ ] Test modals on mobile (ensure they're scrollable)
- [ ] Optimize font sizes for readability
- [ ] Test bottom navigation on various screen sizes
- [ ] Add viewport meta tag if missing

## Pages to Test
- Landing page
- Onboarding flow
- Pulse feed
- Parlor
- Notice Board  
- Profile

## Acceptance Criteria
- All pages render correctly on mobile
- No horizontal scrolling
- All interactive elements are easily tappable
- Modals don't extend beyond viewport
"@

# ============================================
# TESTING & DOCUMENTATION (Low Priority)
# ============================================

Write-Host "Creating Testing & Documentation issues..." -ForegroundColor Green

gh issue create --repo $REPO `
  --title "Write Unit Tests for Core Functions" `
  --label "testing,enhancement" `
  --body @"
## Description
Add unit tests for critical JavaScript functions.

## Tasks
- [ ] Choose testing framework (Jest, Vitest, or Mocha)
- [ ] Set up test environment
- [ ] Write tests for \`pulse.js\` functions
- [ ] Write tests for \`parlor.js\` functions
- [ ] Write tests for \`profile.js\` functions
- [ ] Write tests for date/time utilities
- [ ] Add CI/CD pipeline to run tests

## Test Coverage Goals
- Pulse creation and acknowledgment
- Message sending and rendering
- Privacy setting validation
- Hearth Key generation
- Sunset Timer time calculations

## Acceptance Criteria
- At least 60% code coverage
- All critical paths tested
- Tests pass in CI/CD
"@

gh issue create --repo $REPO `
  --title "Create User Documentation / Help Center" `
  --label "documentation" `
  --body @"
## Description
Create user-facing documentation explaining Hearth's features.

## Tasks
- [ ] Create \`docs/\` folder
- [ ] Write "Getting Started" guide
- [ ] Document privacy controls and what they do
- [ ] Explain Hearth Key system
- [ ] Document Pulse visibility settings
- [ ] Create FAQ page
- [ ] Add screenshots/GIFs for clarity

## Topics to Cover
- What is a Hearth Key?
- How do I add Kin?
- What's the difference between Kin and Inner Circle?
- How do privacy settings work?
- What is Quiet Mode?
- How does Sunset Timer work?

## Acceptance Criteria
- Clear, concise documentation
- Screenshots illustrate key concepts
- Accessible from within the app
"@

gh issue create --repo $REPO `
  --title "Set Up Continuous Deployment Pipeline" `
  --label "devops,enhancement" `
  --body @"
## Description
Automate deployment to Netlify on merge to main branch.

## Tasks
- [ ] Configure Netlify build settings
- [ ] Set up environment variables in Netlify
- [ ] Create deployment preview for PRs
- [ ] Add build status badge to README
- [ ] Configure custom domain (if applicable)
- [ ] Set up SSL certificate
- [ ] Test deployment process

## Acceptance Criteria
- Merges to \`main\` trigger automatic deploys
- PRs generate preview deployments
- Environment variables are properly set
- SSL works correctly
"@

# ============================================
# FUTURE ENHANCEMENTS (Backlog)
# ============================================

Write-Host "Creating Future Enhancement issues..." -ForegroundColor Green

gh issue create --repo $REPO `
  --title "[Future] Implement Contact Discovery System" `
  --label "feature,future,requires-backend" `
  --body @"
## Description
Allow users to find Kin from their phone contacts (opt-in).

## Tasks
- [ ] Create UI for contact upload
- [ ] Hash phone numbers client-side before upload
- [ ] Build Netlify Function to accept hashed contacts
- [ ] Store hashed contacts in Supabase
- [ ] Match against other users' hashed contacts
- [ ] Show "People You May Know" suggestions
- [ ] Allow sending Kin requests from suggestions

## Privacy Considerations
- ⚠️ Hash phone numbers before upload
- ⚠️ Never store plain-text phone numbers
- ⚠️ Users must explicitly opt-in
- ⚠️ Provide clear data deletion option

## Implementation Guide
See [FUTURE_FEATURES.md](../blob/main/FUTURE_FEATURES.md#allow-contacts-to-find-me-toggle) for details.

## Acceptance Criteria
- Contact upload is opt-in only
- Phone numbers are hashed
- Matching algorithm is accurate
- Users can delete their contact data
"@

gh issue create --repo $REPO `
  --title "[Future] Add Push Notifications (Opt-In)" `
  --label "feature,future" `
  --body @"
## Description
Implement opt-in push notifications for important events.

## Notification Types
- New Kin request
- Event RSVP changes
- Upcoming events (24h before)
- (Optional) New messages if Quiet Mode is off

## Tasks
- [ ] Implement service worker for PWA
- [ ] Request notification permissions
- [ ] Store push subscription in database
- [ ] Send notifications via Netlify Functions
- [ ] Add notification preferences to Profile
- [ ] Respect Quiet Mode setting

## Privacy Notes
- Must be opt-in (default OFF)
- Users control which notifications they receive
- Honor "Do Not Disturb" hours

## Acceptance Criteria
- Notifications only sent if user opts in
- Users can granularly control notification types
- Quiet Mode disables all notifications
"@

gh issue create --repo $REPO `
  --title "[Future] Implement PWA Features" `
  --label "feature,future,pwa" `
  --body @"
## Description
Convert Hearth to a Progressive Web App for better mobile experience.

## Tasks
- [ ] Create \`manifest.json\` with app metadata
- [ ] Add app icons (various sizes)
- [ ] Implement service worker for offline support
- [ ] Cache static assets
- [ ] Add "Add to Home Screen" prompt
- [ ] Test install flow on iOS and Android

## PWA Features
- Installable on mobile devices
- Works offline (show cached content)
- Splash screen on launch
- Feels like native app

## Acceptance Criteria
- App can be installed from browser
- Works offline for basic functionality
- Passes Lighthouse PWA audit
"@

Write-Host ""
Write-Host "✅ All GitHub issues created successfully!" -ForegroundColor Green
Write-Host "Check your repository: https://github.com/$REPO/issues" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review and prioritize issues" -ForegroundColor White
Write-Host "2. Assign issues to Jules" -ForegroundColor White
Write-Host "3. Add milestones or projects as needed" -ForegroundColor White
