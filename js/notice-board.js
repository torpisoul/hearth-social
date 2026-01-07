// Notice Board (Events) Logic

let events = [];
let currentEventId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    initializeNewEventModal();
    initializeEventDetailsModal();
});

// Load events from localStorage
function loadEvents() {
    const saved = localStorage.getItem('hearthEvents');

    if (saved) {
        try {
            events = JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse events:', e);
            events = getSampleEvents();
        }
    } else {
        events = getSampleEvents();
    }

    renderEventsList();
}

// Sample events for demo
function getSampleEvents() {
    const currentUser = getCurrentUser();
    const userName = currentUser ? currentUser.displayName : 'You';

    // Create future dates
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    const nextWeekend = new Date();
    nextWeekend.setDate(nextWeekend.getDate() + 7);
    nextWeekend.setHours(10, 0, 0, 0);

    return [
        {
            id: 'event-1',
            hostId: 'demo-user-1',
            hostName: 'Jamie',
            title: 'Weekend Coffee Meetup',
            description: "Let's catch up over some good coffee! I know a great new place in town.",
            eventDate: tomorrow.getTime(),
            location: 'The Bean House Café',
            guestListVisible: true,
            invitees: [
                { id: 'current-user', name: userName, rsvp: 'pending' },
                { id: 'demo-user-2', name: 'Alex', rsvp: 'yes' }
            ],
            createdAt: Date.now() - 86400000
        },
        {
            id: 'event-2',
            hostId: 'current-user',
            hostName: userName,
            title: 'Sunday Hike',
            description: 'Morning hike through the nature trail. Bring water and good shoes!',
            eventDate: nextWeekend.getTime(),
            location: 'Greenwood Trail',
            guestListVisible: false,
            invitees: [
                { id: 'demo-user-1', name: 'Jamie', rsvp: 'yes' },
                { id: 'demo-user-2', name: 'Alex', rsvp: 'maybe' }
            ],
            createdAt: Date.now() - 172800000
        }
    ];
}

// Render events list
function renderEventsList() {
    const timeline = document.getElementById('events-timeline');
    const emptyState = document.getElementById('empty-events');

    if (!timeline) return;

    if (events.length === 0) {
        timeline.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    timeline.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';

    // Sort chronologically (soonest first)
    const sorted = [...events].sort((a, b) => a.eventDate - b.eventDate);

    timeline.innerHTML = '';

    sorted.forEach(event => {
        const card = createEventCard(event);
        timeline.appendChild(card);
    });
}

// Create event card
function createEventCard(event) {
    const div = document.createElement('div');
    const currentUser = getCurrentUser();
    const isHost = event.hostId === 'current-user';
    const currentUserInvite = event.invitees.find(inv => inv.id === 'current-user');
    const rsvpStatus = currentUserInvite ? currentUserInvite.rsvp : 'not-invited';

    div.className = `event-card card ${isHost ? 'hosting' : ''}`;
    div.onclick = () => openEventDetails(event.id);

    const eventDateObj = new Date(event.eventDate);
    const dateStr = eventDateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    });
    const timeStr = eventDateObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });

    const respondedCount = event.invitees.filter(inv => inv.rsvp === 'yes').length;
    const totalInvitees = event.invitees.length;

    div.innerHTML = `
    <div class="event-header">
      <div class="event-info">
        <h3 class="event-title">${escapeHtml(event.title)}</h3>
        <p class="event-host">
          ${isHost ? 'Hosted by <strong>You</strong>' : `Hosted by <strong>${event.hostName}</strong>`}
        </p>
      </div>
      ${isHost ? '<span class="badge-primary badge">Hosting</span>' : ''}
    </div>
    
    <div class="event-meta">
      <div class="event-meta-item">
        <span class="meta-icon">📅</span>
        <span>${dateStr} at ${timeStr}</span>
      </div>
      ${event.location ? `
        <div class="event-meta-item">
          <span class="meta-icon">📍</span>
          <span>${escapeHtml(event.location)}</span>
        </div>
      ` : ''}
    </div>
    
    ${event.description ? `
      <p class="event-description">${escapeHtml(event.description)}</p>
    ` : ''}
    
    <div class="event-footer">
      <div class="event-guests">
        <span>${respondedCount} / ${totalInvitees} attending</span>
        ${event.guestListVisible ? `
          <div class="guest-avatars">
            ${event.invitees.filter(inv => inv.rsvp === 'yes').slice(0, 3).map(inv => `
              <div class="guest-avatar">${getAvatarEmoji(inv.id)}</div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      ${!isHost ? `
        <span class="event-rsvp-status ${rsvpStatus}">
          ${getRsvpLabel(rsvpStatus)}
        </span>
      ` : ''}
    </div>
  `;

    return div;
}

// Get RSVP label
function getRsvpLabel(status) {
    const labels = {
        'yes': '✓ You're going',
    'maybe': '? You might go',
        'no': '✕ You declined',
        'pending': '⏱ RSVP needed'
    };
    return labels[status] || status;
}

// Open event details modal
function openEventDetails(eventId) {
    currentEventId = eventId;
    const event = events.find(e => e.id === eventId);

    if (!event) return;

    const modal = document.getElementById('event-details-modal');

    // Populate details
    document.getElementById('event-details-title').textContent = event.title;

    const eventDateObj = new Date(event.eventDate);
    const dateStr = eventDateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });

    document.getElementById('details-date').textContent = dateStr;
    document.getElementById('details-location').textContent = event.location || 'No location specified';
    document.getElementById('details-host').textContent = event.hostName;
    document.getElementById('details-description').textContent = event.description || 'No description provided';

    // Guest list
    const guestListSection = document.getElementById('details-guest-list-section');
    const guestList = document.getElementById('details-guest-list');

    if (event.guestListVisible || event.hostId === 'current-user') {
        guestListSection.style.display = 'flex';
        guestList.innerHTML = '';

        event.invitees.forEach(invitee => {
            const guestDiv = document.createElement('div');
            guestDiv.className = 'guest-item';
            guestDiv.innerHTML = `
        <div class="avatar">${getAvatarEmoji(invitee.id)}</div>
        <span class="guest-name">${invitee.name}</span>
        <span class="guest-rsvp">${getRsvpLabel(invitee.rsvp)}</span>
      `;
            guestList.appendChild(guestDiv);
        });
    } else {
        guestListSection.style.display = 'none';
    }

    // RSVP buttons
    const rsvpButtons = document.querySelectorAll('#rsvp-buttons .btn');
    const currentUserInvite = event.invitees.find(inv => inv.id === 'current-user');

    if (currentUserInvite) {
        rsvpButtons.forEach(btn => {
            const rsvp = btn.dataset.rsvp;
            btn.classList.toggle('active', rsvp === currentUserInvite.rsvp);

            btn.onclick = () => updateRsvp(eventId, rsvp);
        });
    }

    modal.classList.add('active');
}

// Update RSVP
function updateRsvp(eventId, rsvpStatus) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const currentUserInvite = event.invitees.find(inv => inv.id === 'current-user');
    if (!currentUserInvite) return;

    currentUserInvite.rsvp = rsvpStatus;

    saveEvents();
    renderEventsList();

    // Update button states
    const rsvpButtons = document.querySelectorAll('#rsvp-buttons .btn');
    rsvpButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.rsvp === rsvpStatus);
    });
}

// Initialize new event modal
function initializeNewEventModal() {
    const newEventBtn = document.getElementById('new-event-btn');
    const modal = document.getElementById('new-event-modal');
    const closeBtn = document.getElementById('close-event-modal');
    const cancelBtn = document.getElementById('cancel-event-btn');
    const form = document.getElementById('new-event-form');

    const openModal = () => modal?.classList.add('active');
    const closeModal = () => {
        modal?.classList.remove('active');
        form?.reset();
    };

    newEventBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        createNewEvent();
        closeModal();
    });
}

// Create new event
function createNewEvent() {
    const title = document.getElementById('event-title').value.trim();
    const description = document.getElementById('event-description').value.trim();
    const dateInput = document.getElementById('event-date').value;
    const location = document.getElementById('event-location').value.trim();
    const guestListVisible = document.getElementById('guest-list-visible').checked;

    if (!title || !dateInput) {
        alert('Please fill in the required fields (Title and Date).');
        return;
    }

    const eventDate = new Date(dateInput).getTime();

    const selectedKin = Array.from(document.querySelectorAll('input[name="event-kin"]:checked'))
        .map(cb => cb.value);

    const currentUser = getCurrentUser();
    const userName = currentUser ? currentUser.displayName : 'You';

    const invitees = selectedKin.map(id => ({
        id,
        name: id === 'demo-user-1' ? 'Jamie' : id === 'demo-user-2' ? 'Alex' : 'Unknown',
        rsvp: 'pending'
    }));

    const newEvent = {
        id: `event-${Date.now()}`,
        hostId: 'current-user',
        hostName: userName,
        title,
        description,
        eventDate,
        location,
        guestListVisible,
        invitees,
        createdAt: Date.now()
    };

    events.push(newEvent);
    saveEvents();
    renderEventsList();
}

// Initialize event details modal
function initializeEventDetailsModal() {
    const modal = document.getElementById('event-details-modal');
    const closeBtn = document.getElementById('close-details-modal');

    const closeModal = () => {
        modal?.classList.remove('active');
        currentEventId = null;
    };

    closeBtn?.addEventListener('click', closeModal);

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

// Save events to localStorage
function saveEvents() {
    localStorage.setItem('hearthEvents', JSON.stringify(events));
}

// Helper: Get avatar emoji
function getAvatarEmoji(userId) {
    const avatars = {
        'current-user': '😊',
        'demo-user-1': '🌻',
        'demo-user-2': '🍃'
    };
    return avatars[userId] || '👤';
}

// Helper: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
