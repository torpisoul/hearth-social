// Pulse Feed Logic

let pulses = [];
let acknowledgedPulses = new Set();

document.addEventListener('DOMContentLoaded', () => {
    loadPulses();
    initializePulseForm();
    loadAcknowledgments();
});

// Load pulses (from localStorage for now, will be Supabase later)
function loadPulses() {
    const savedPulses = localStorage.getItem('hearthPulses');

    if (savedPulses) {
        try {
            pulses = JSON.parse(savedPulses);
        } catch (e) {
            console.error('Failed to parse pulses:', e);
            pulses = getSamplePulses();
        }
    } else {
        pulses = getSamplePulses();
    }

    renderPulses();
}

// Sample pulses for demonstration
function getSamplePulses() {
    const currentUser = getCurrentUser();
    const displayName = currentUser ? currentUser.displayName : 'You';

    return [
        {
            id: 'pulse-1',
            author: displayName,
            authorId: 'current-user',
            content: "Setting up my Hearth for the first time. This feels right. 🌿",
            visibility: 'all-kin',
            timestamp: Date.now() - 3600000,
            acknowledgedBy: []
        },
        {
            id: 'pulse-2',
            author: 'Jamie',
            authorId: 'demo-user-1',
            content: "Just finished a great book. Sometimes it's nice to unplug and read.",
            visibility: 'all-kin',
            timestamp: Date.now() - 7200000,
            acknowledgedBy: []
        },
        {
            id: 'pulse-3',
            author: 'Alex',
            authorId: 'demo-user-2',
            content: "Coffee and quiet mornings. That's the life. ☕",
            visibility: 'inner-circle',
            timestamp: Date.now() - 10800000,
            acknowledgedBy: []
        }
    ];
}

// Render pulses to feed
function renderPulses() {
    const pulseFeed = document.getElementById('pulse-feed');
    if (!pulseFeed) return;

    // Clear existing pulses (keep caught-up message)
    const caughtUp = document.getElementById('caught-up');
    pulseFeed.innerHTML = '';

    if (pulses.length === 0) {
        pulseFeed.appendChild(caughtUp);
        return;
    }

    // Sort chronologically (newest first)
    const sortedPulses = [...pulses].sort((a, b) => b.timestamp - a.timestamp);

    sortedPulses.forEach(pulse => {
        const pulseElement = createPulseElement(pulse);
        pulseFeed.appendChild(pulseElement);
    });

    // Add caught-up message at the end
    pulseFeed.appendChild(caughtUp);
}

// Create pulse HTML element
function createPulseElement(pulse) {
    const div = document.createElement('div');
    div.className = 'pulse-item card';
    div.dataset.pulseId = pulse.id;

    const isAcknowledged = acknowledgedPulses.has(pulse.id);
    const acknowledgeClass = isAcknowledged ? 'acknowledged' : '';

    const visibilityBadge = pulse.visibility === 'inner-circle'
        ? '<span class="badge-primary badge">Inner Circle</span>'
        : pulse.visibility === 'private'
            ? '<span class="badge">Private</span>'
            : '<span class="badge">All Kin</span>';

    div.innerHTML = `
    <div class="pulse-header">
      <div class="pulse-author">
        <div class="avatar">${getAvatarEmoji(pulse.authorId)}</div>
        <div class="author-info">
          <div class="author-name">${pulse.author}</div>
          <div class="pulse-time">${getRelativeTime(pulse.timestamp)}</div>
        </div>
      </div>
      ${visibilityBadge}
    </div>
    
    <div class="pulse-content">
      <p>${escapeHtml(pulse.content)}</p>
    </div>
    
    <div class="pulse-actions">
      <button class="pulse-action-btn ${acknowledgeClass}" onclick="acknowledgePulse('${pulse.id}')">
        <span class="action-icon">✓</span>
        <span class="action-label">${isAcknowledged ? 'Acknowledged' : 'Acknowledge'}</span>
      </button>
      <button class="pulse-action-btn" onclick="respondToPulse('${pulse.id}')">
        <span class="action-icon">💬</span>
        <span class="action-label">Respond</span>
      </button>
    </div>
  `;

    return div;
}

// Get avatar emoji based on user ID
function getAvatarEmoji(userId) {
    const avatars = {
        'current-user': '😊',
        'demo-user-1': '🌻',
        'demo-user-2': '🍃'
    };
    return avatars[userId] || '👤';
}

// Get relative time string
function getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize new pulse form
function initializePulseForm() {
    const form = document.getElementById('new-pulse-form');
    if (!form) return;

    form.addEventListener('submit', handleNewPulse);
}

// Handle new pulse submission
async function handleNewPulse(e) {
    e.preventDefault();

    const content = document.getElementById('pulse-content').value.trim();
    const visibility = document.getElementById('pulse-visibility').value;

    if (!content) {
        alert('Please write something to share.');
        return;
    }

    const currentUser = getCurrentUser();
    const displayName = currentUser ? currentUser.displayName : 'Anonymous';

    const newPulse = {
        id: `pulse-${Date.now()}`,
        author: displayName,
        authorId: 'current-user',
        content: content,
        visibility: visibility,
        timestamp: Date.now(),
        acknowledgedBy: []
    };

    // Add to pulses array
    pulses.unshift(newPulse);

    // Save to localStorage (will be Supabase later)
    localStorage.setItem('hearthPulses', JSON.stringify(pulses));

    // Re-render feed
    renderPulses();

    // Close modal and reset form
    document.getElementById('new-pulse-modal').classList.remove('active');
    document.getElementById('new-pulse-form').reset();

    console.log('New pulse created:', newPulse);
}

// Acknowledge a pulse
function acknowledgePulse(pulseId) {
    if (acknowledgedPulses.has(pulseId)) {
        // Un-acknowledge
        acknowledgedPulses.delete(pulseId);
    } else {
        // Acknowledge with gentle feedback
        acknowledgedPulses.add(pulseId);
    }

    // Save acknowledgments
    localStorage.setItem('acknowledgedPulses', JSON.stringify([...acknowledgedPulses]));

    // Re-render to update UI
    renderPulses();
}

// Load acknowledgments from storage
function loadAcknowledgments() {
    const saved = localStorage.getItem('acknowledgedPulses');
    if (saved) {
        try {
            acknowledgedPulses = new Set(JSON.parse(saved));
        } catch (e) {
            console.error('Failed to parse acknowledgments:', e);
        }
    }
}

// Respond to pulse (opens 1-on-1 conversation)
function respondToPulse(pulseId) {
    const pulse = pulses.find(p => p.id === pulseId);
    if (!pulse) return;

    // Store context for Parlor to pick up
    const context = {
        pulseId: pulse.id,
        authorId: pulse.authorId,
        authorName: pulse.author
    };
    sessionStorage.setItem('pulseResponseContext', JSON.stringify(context));

    // Navigate to Parlor
    window.location.href = 'parlor.html';
}
