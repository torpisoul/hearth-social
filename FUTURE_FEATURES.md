# Future Features & Implementation Notes

This document outlines features that are planned but not yet implemented, along with notes on how they could be built.

## QR Code Sharing

**Feature:** Generate QR codes for Hearth Keys to make it easy to add Kin in person.

**Implementation Plan:**
- Use a JavaScript QR code library like [qrcode.js](https://github.com/davidshimjs/qrcodejs) or [qr-code-generator](https://www.npmjs.com/package/qr-code-generator)
- When user clicks "Share via QR" button, generate a QR code containing their Hearth Key
- Display in the existing QR modal (currently showing placeholder)
- Optionally add ability to scan QR codes using device camera

**Code Location:**
- `js/profile.js` - Add QR generation in the `shareHearthKey()` function
- `profile.html` - QR mo dal already exists, just needs real QR rendering

**Libraries to Consider:**
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
```

```javascript
function showQRCode() {
  const user = getCurrentUser();
  const qrContainer = document.getElementById('qr-code');
  qrContainer.innerHTML = ''; // Clear placeholder
  
  new QRCode(qrContainer, {
    text: user.hearthKey,
    width: 280,
    height: 280
  });
}
```

---

## "Allow Contacts to Find Me" Toggle

**Feature:** Let users opt-in to being discoverable by phone contacts.

**Current Status:**  
Toggle exists in Profile but doesn't connect to any backend logic.

**Implementation Plan:**
1. When enabled, user uploads their phone contacts (hashed for privacy)
2. Backend matches hashed phone numbers to Hearth users
3. System suggests "People You May Know" based on mutual contacts
4. Users can then send Kin requests

**Privacy Considerations:**
- Hash phone numbers before upload
- Never store plain-text phone numbers
- Users must explicitly opt-in
- Clear data deletion option

**Backend Required:**
- Netlify Function to accept hashed contacts
- Supabase table: `contact_hashes` (user_id, contact_hash)
- Matching algorithm to find mutual contacts

**Code Location:**
- `js/profile.js` - Add contact upload logic when toggle is enabled
- New Netlify Function: `functions/sync-contacts.js`

---

## Edit Kin Relationships

**Feature:** Allow users to edit their Kin list (change relationship tier, remove Kin).

**Current Status:**  
"Remove" and "Message" buttons exist but aren't functional.

**Implementation Plan:**

### Change Relationship Tier
- Add dropdown or modal to change between "Kin" and "Inner Circle"
- Update in localhost and Supabase
- Affect what content that person can see

### Remove Kin
- Confirmation dialog: "Are you sure you want to remove [Name] from your Kin?"
- Delete from `kin_relationships` table (mutual deletion)
- Update UI to remove from list

**Code Location:**
- `js/profile.js` - Add handlers for the existing buttons
- When Supabase integrated: `functions/kin-management.js`

**Example:**
```javascript
function removeKin(kinId) {
  if (!confirm('Are you sure you want to remove this person from your Kin?')) return;
  
  const user = getCurrentUser();
  // Remove from localStorage (for now)
  const kinList = JSON.parse(localStorage.getItem('kinList') || '[]');
  const updated = kinList.filter(k => k.id !== kinId);
  localStorage.setItem('kinList', JSON.stringify(updated));
  
  // In production: API call to remove from database
  // Remove from both sides of the relationship
  
  // Refresh UI
  location.reload();
}
```

---

## Customizable Sunset Timer Hours

**Feature:** Let users set custom start/end times for Sunset Timer instead of hardcoded 8 PM - 6 AM.

**Current Status:**  
Sunset Timer works with hardcoded logic in `app.js`.

**Implementation Plan:**

### UI Changes
Add to Profile settings or dedicated Sunset Timer modal:
```html
<div class="form-group">
  <label>Sunset Timer Active Hours</label>
  <div class="time-range">
    <input type="time" id="sunset-start" value="20:00"> 
    to 
    <input type="time" id="sunset-end" value="06:00">
  </div>
</div>
```

### Logic Changes
Update `app.js` to read custom times from localStorage:
```javascript
function checkAndApplySunsetTimer() {
  const sunsetStart = localStorage.getItem('sunsetStartHour') || 20;
  const sunsetEnd = localStorage.getItem('sunsetEndHour') || 6;
  
  const currentHour = new Date().getHours();
  
  // Check if current time is in sunset range
  const inSunsetRange = (sunsetEnd < sunsetStart) 
    ? (currentHour >= sunsetStart || currentHour < sunsetEnd)  // Crosses midnight
    : (currentHour >= sunsetStart && currentHour < sunsetEnd);   // Same day
    
  if (inSunsetRange) {
    document.body.classList.add('sunset-active');
  }
}
```

**Code Location:**
- `profile.html` - Add time inputs in Sunset Timer settings section
- `js/profile.js` - Save custom hours to localStorage
- `js/app.js` - Update `checkAndApplySunsetTimer()` to use custom hours

---

## Media Expiration in Parlor

**Feature:** Photos and videos in Parlor messages auto-delete after a set time.

**Current Status:**  
Media upload works, but no expiration logic.

**Implementation Plan:**
- Add `mediaExpiresAt` timestamp to messages
- When rendering messages, check if media has expired
- If expired, show placeholder: "Media expired for privacy"
- Default expiration: 24 hours, user can choose (1 hour, 24 hours, 7 days, Never)

**Code Location:**
- `parlor.html` - Add expiration selector when uploading media
- `js/parlor.js` - Check expiration when rendering messages
- Supabase: Store `media_expires_at` field

---

## Delete Kin Feature Plan

When "Remove" button is clicked on Kin card:

```javascript
function initializeKinActions() {
  // Message buttons
  document.querySelectorAll('.kin-card .btn:nth-child(1)').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const kinName = btn.closest('.kin-card').querySelector('.kin-name').textContent;
      // Open Parlor with this person
      // Store context and navigate
      sessionStorage.setItem('pulseResponseContext', JSON.stringify({
        authorName: kinName,
        authorId: 'demo-user-1' // would be actual ID
      }));
      window.location.href = 'parlor.html';
    });
  });
  
  // Remove buttons
  document.querySelectorAll('.kin-card .btn:nth-child(2)').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const kinName = btn.closest('.kin-card').querySelector('.kin-name').textContent;
      
      if (confirm(`Remove ${kinName} from your Kin? They will no longer see your updates.`)) {
        // Remove logic here
        btn.closest('.kin-card').remove();
        // TODO: Update database when Supabase is integrated
      }
    });
  });
}
```

---

## Summary

These features represent the natural evolution of Hearth:

**Ready to implement (just JavaScript):**
- ✅ QR Code generation (add library + 10 lines of code)
- ✅ Custom Sunset Hours (UI + localStorage logic)
- ✅ Remove Kin functionality (confirmation + UI update)

**Requires backend (Supabase + Netlify Functions):**
- Contact syncing for discoverability
- Media expiration automation
- Kin relationship tier management

All of these align with Hearth's core philosophy of privacy, consent, and intentionality. 🌿
