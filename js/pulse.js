// Pulse Feed Logic

let pulses = [];
let acknowledgedPulses = new Set();

document.addEventListener('DOMContentLoaded', () => {
    loadPulses();
    initializePulseForm();
    loadAcknowledgments();
    initializeCategoryFilters();
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
    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const displayName = currentUser ? currentUser.displayName : 'You';

    return [
        {
            id: 'pulse-1',
            author: displayName,
            authorId: 'current-user',
            content: "Setting up my Hearth for the first time. This feels right. 🌿",
            visibility: 'all-kin',
            category: 'life',
            timestamp: Date.now() - 3600000,
            acknowledgedBy: []
        },
        {
            id: 'pulse-2',
            author: 'Jamie',
            authorId: 'demo-user-1',
            content: "Just finished a great book. Sometimes it's nice to unplug and read.",
            visibility: 'all-kin',
            category: 'art',
            timestamp: Date.now() - 7200000,
            acknowledgedBy: []
        },
        {
            id: 'pulse-3',
            author: 'Alex',
            authorId: 'demo-user-2',
            content: "Coffee and quiet mornings. That's the life. ☕",
            visibility: 'inner-circle',
            category: 'food',
            timestamp: Date.now() - 10800000,
            acknowledgedBy: []
        }
    ];
}

// Render pulses to feed
function renderPulses() {
    const pulseFeed = document.getElementById('pulse-feed');
    if (!pulseFeed) return;

    // Get user preferences
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    const preferences = user ? (user.feedPreferences || []) : [];

    // Clear existing pulses
    pulseFeed.innerHTML = '';

    if (preferences.length === 0) {
        pulseFeed.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <h3>Your feed is waiting 🌱</h3>
                <p>Select some categories above to start seeing pulses from your Kin.</p>
            </div>
        `;
        return;
    }

    // Filter pulses based on preferences
    const visiblePulses = pulses.filter(pulse => {
        // Always show own pulses? Maybe, but usually feed filters apply to consumption.
        // If I wrote it, I probably want to see it?
        // Backend logic says "Always show own pulses". Let's match that.
        if (pulse.authorId === 'current-user') return true;

        if (!pulse.category) return false;
        return preferences.some(pref => pref.toLowerCase() === pulse.category.toLowerCase());
    });

    if (visiblePulses.length === 0) {
        pulseFeed.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <p>No pulses found for your selected categories yet.</p>
            </div>
        `;
        return;
    }

    // Sort chronologically (newest first)
    const sortedPulses = [...visiblePulses].sort((a, b) => b.timestamp - a.timestamp);

    sortedPulses.forEach(pulse => {
        const pulseElement = createPulseElement(pulse);
        pulseFeed.appendChild(pulseElement);
    });

    // Add caught-up message at the end
    const caughtUpDiv = document.createElement('div');
    caughtUpDiv.className = 'caught-up-message';
    caughtUpDiv.id = 'caught-up';
    caughtUpDiv.innerHTML = `
        <div class="caught-up-icon">☕</div>
        <h3 class="caught-up-title">You're all caught up</h3>
        <p class="caught-up-text">No more updates in these categories. Go enjoy your day! 🌿</p>
    `;
    pulseFeed.appendChild(caughtUpDiv);
}

// Initialize Category Filters
function initializeCategoryFilters() {
    renderCategoryFilters();
}

// Render Category Filters
function renderCategoryFilters() {
    const container = document.getElementById('category-filters');
    if (!container) return;

    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    const preferences = user ? (user.feedPreferences || []) : [];

    const categories = ['Life', 'Tech', 'Art', 'Food', 'Nature', 'Music', 'Travel', 'Wellness', 'Politics', 'Science'];

    container.innerHTML = '';

    categories.forEach(category => {
        const isActive = preferences.includes(category);

        const pill = document.createElement('button');
        pill.className = `filter-pill ${isActive ? 'active' : ''}`;
        pill.textContent = category;
        pill.onclick = () => toggleCategoryFilter(category);

        container.appendChild(pill);
    });
}

// Toggle Category Filter
async function toggleCategoryFilter(category) {
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (!user) return;

    if (!user.feedPreferences) user.feedPreferences = [];

    if (user.feedPreferences.includes(category)) {
        user.feedPreferences = user.feedPreferences.filter(c => c !== category);
    } else {
        user.feedPreferences.push(category);
    }

    // Save locally
    localStorage.setItem('hearthUser', JSON.stringify(user));

    // Update UI
    renderCategoryFilters();
    renderPulses();

    // Sync with backend
    const token = localStorage.getItem('hearthToken');
    if (token) {
        try {
            await fetch('/api/auth/user', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    feedPreferences: user.feedPreferences
                })
            });
        } catch (e) {
            console.error('Failed to sync preferences', e);
        }
    }
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

    const categoryBadge = pulse.category
        ? `<span class="badge badge-category" style="margin-left: auto;">${escapeHtml(pulse.category)}</span>`
        : '';

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
      ${categoryBadge}
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

    const contentInput = document.getElementById('pulse-content');
    const visibilityInput = document.getElementById('pulse-visibility');
    const categoryInput = document.getElementById('pulse-category');

    if (!contentInput || !visibilityInput) return;

    const content = contentInput.value.trim();
    const visibility = visibilityInput.value;
    const category = categoryInput ? categoryInput.value : 'life';

    if (!content) {
        alert('Please write something to share.');
        return;
    }

    const currentUser = window.getCurrentUser ? window.getCurrentUser() : null;
    const displayName = currentUser ? currentUser.displayName : 'Anonymous';

    const newPulse = {
        id: `pulse-${Date.now()}`,
        author: displayName,
        authorId: 'current-user',
        content: content,
        visibility: visibility,
        category: category,
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
    const modal = document.getElementById('new-pulse-modal');
    const form = document.getElementById('new-pulse-form');

    if (modal) modal.classList.remove('active');
    if (form) form.reset();

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

// Export and attach to window
window.handleNewPulse = handleNewPulse;
window.acknowledgePulse = acknowledgePulse;
window.respondToPulse = respondToPulse;
window.renderPulses = renderPulses;
window.createPulseElement = createPulseElement;
window.getRelativeTime = getRelativeTime;
window.escapeHtml = escapeHtml;
window.initializeCategoryFilters = initializeCategoryFilters;
window.toggleCategoryFilter = toggleCategoryFilter;

export { handleNewPulse, acknowledgePulse, respondToPulse, renderPulses, createPulseElement, getRelativeTime, escapeHtml, loadPulses, initializeCategoryFilters, toggleCategoryFilter };
