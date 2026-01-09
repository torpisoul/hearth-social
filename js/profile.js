// Profile Page Logic

document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    initializePrivacyControls();
    initializeLifeUpdates();
    initializeHearthKey();
    initializeKinManagement();
    initializeSettings();
    initializeLogout();
});

// Load user profile
function loadProfile() {
    const user = getCurrentUser();

    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Display name
    const nameElement = document.getElementById('profile-name');
    if (nameElement) {
        nameElement.textContent = user.displayName || 'Hearth Dweller';
    }

    // Hearth Key
    const hearthKeyElement = document.getElementById('profile-hearth-key');
    if (hearthKeyElement) {
        hearthKeyElement.textContent = user.hearthKey || 'HEARTH-XXXX-XXXX-XXXX';
    }
}

// Initialize privacy controls
function initializePrivacyControls() {
    const user = getCurrentUser();
    if (!user) return;

    const privacy = user.privacy || {};

    // Set toggle states
    const discoverableToggle = document.getElementById('setting-discoverable');
    const readReceiptsToggle = document.getElementById('setting-read-receipts');
    const cloudBackupToggle = document.getElementById('setting-cloud-backup');

    if (discoverableToggle) {
        discoverableToggle.checked = privacy.discoverable || false;
        discoverableToggle.addEventListener('change', () => savePrivacySetting('discoverable', discoverableToggle.checked));
    }

    if (readReceiptsToggle) {
        readReceiptsToggle.checked = privacy.readReceipts || false;
        readReceiptsToggle.addEventListener('change', () => savePrivacySetting('readReceipts', readReceiptsToggle.checked));
    }

    if (cloudBackupToggle) {
        cloudBackupToggle.checked = privacy.cloudBackup || false;
        cloudBackupToggle.addEventListener('change', () => savePrivacySetting('cloudBackup', cloudBackupToggle.checked));
    }
}

// Save privacy setting
function savePrivacySetting(key, value) {
    const user = getCurrentUser();
    if (!user) return;

    if (!user.privacy) user.privacy = {};
    user.privacy[key] = value;

    localStorage.setItem('hearthUser', JSON.stringify(user));
    console.log('Privacy setting saved:', key, value);
}

// Initialize life updates
function initializeLifeUpdates() {
    const user = getCurrentUser();
    if (!user) return;

    const lifeUpdates = user.lifeUpdates || {};

    // Set values
    const jobValue = document.getElementById('job-value');
    const locationValue = document.getElementById('location-value');
    const relationshipValue = document.getElementById('relationship-value');

    if (jobValue) jobValue.value = lifeUpdates.job || '';
    if (locationValue) locationValue.value = lifeUpdates.location || '';
    if (relationshipValue) relationshipValue.value = lifeUpdates.relationship || '';

    // Set visibility
    const jobVisibility = document.getElementById('job-visibility');
    const locationVisibility = document.getElementById('location-visibility');
    const relationshipVisibility = document.getElementById('relationship-visibility');

    const privacy = user.privacy || {};

    if (jobVisibility) jobVisibility.value = privacy.jobVisibility || 'private';
    if (locationVisibility) locationVisibility.value = privacy.locationVisibility || 'private';
    if (relationshipVisibility) relationshipVisibility.value = privacy.relationshipVisibility || 'private';

    // Save button
    const saveBtn = document.getElementById('save-life-updates');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveLifeUpdates);
    }
}

// Save life updates
function saveLifeUpdates() {
    const user = getCurrentUser();
    if (!user) return;

    // Get values
    const job = document.getElementById('job-value').value.trim();
    const location = document.getElementById('location-value').value.trim();
    const relationship = document.getElementById('relationship-value').value;

    // Get visibility
    const jobVisibility = document.getElementById('job-visibility').value;
    const locationVisibility = document.getElementById('location-visibility').value;
    const relationshipVisibility = document.getElementById('relationship-visibility').value;

    // Save to user object
    user.lifeUpdates = { job, location, relationship };
    user.privacy = user.privacy || {};
    user.privacy.jobVisibility = jobVisibility;
    user.privacy.locationVisibility = locationVisibility;
    user.privacy.relationshipVisibility = relationshipVisibility;

    localStorage.setItem('hearthUser', JSON.stringify(user));

    // Visual feedback
    const saveBtn = document.getElementById('save-life-updates');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✓ Saved!';
    saveBtn.classList.add('btn-primary');

    setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.classList.remove('btn-primary');
    }, 2000);
}

// Initialize Hearth Key functions
function initializeHearthKey() {
    const copyBtn = document.getElementById('copy-hearth-key');
    const shareBtn = document.getElementById('share-hearth-key');
    const qrModal = document.getElementById('qr-modal');
    const closeQrBtn = document.getElementById('close-qr-modal');

    if (copyBtn) {
        copyBtn.addEventListener('click', copyHearthKey);
    }

    if (shareBtn && qrModal) {
        shareBtn.addEventListener('click', () => {
            qrModal.classList.add('active');
            showQRCode();
        });
    }

    if (closeQrBtn && qrModal) {
        closeQrBtn.addEventListener('click', () => qrModal.classList.remove('active'));
    }

    if (qrModal) {
        qrModal.addEventListener('click', (e) => {
            if (e.target === qrModal) qrModal.classList.remove('active');
        });
    }
}

// Copy Hearth Key
function copyHearthKey() {
    const user = getCurrentUser();
    if (!user) return;

    const hearthKey = user.hearthKey;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(hearthKey).then(() => {
            showCopyFeedback();
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }
}

function showCopyFeedback() {
    const btn = document.getElementById('copy-hearth-key');
    if (!btn) return;

    const originalText = btn.textContent;
    btn.textContent = 'Copied! ✓';
    btn.classList.add('btn-primary');

    setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('btn-primary');
    }, 2000);
}

// Show QR Code
function showQRCode() {
    const user = getCurrentUser();
    if (!user || !user.hearthKey) return;

    const qrContainer = document.getElementById('qr-code');
    const downloadBtn = document.getElementById('download-qr-btn');

    if (qrContainer) {
        qrContainer.innerHTML = ''; // Clear placeholder/previous code

        // Generate QR Code
        // eslint-disable-next-line no-new
        new QRCode(qrContainer, {
            text: user.hearthKey,
            width: 256,
            height: 256,
            colorDark: "#2c3e50",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    // Set up download button
    if (downloadBtn) {
        // Remove old event listeners to prevent duplicates if function called multiple times
        const newBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);

        newBtn.addEventListener('click', () => {
            const qrImage = qrContainer.querySelector('img');
            if (qrImage) {
                const link = document.createElement('a');
                link.href = qrImage.src;
                link.download = `hearth-key-${user.displayName || 'user'}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        });
    }
}

// Initialize Kin management
function initializeKinManagement() {
    // Add Kin Modal
    const addKinBtn = document.getElementById('add-kin-btn');
    const addKinModal = document.getElementById('add-kin-modal');
    const closeKinBtn = document.getElementById('close-add-kin-modal');
    const cancelKinBtn = document.getElementById('cancel-add-kin');
    const addKinForm = document.getElementById('add-kin-form');

    const openModal = () => addKinModal?.classList.add('active');
    const closeModal = () => {
        addKinModal?.classList.remove('active');
        addKinForm?.reset();
    };

    addKinBtn?.addEventListener('click', openModal);
    closeKinBtn?.addEventListener('click', closeModal);
    cancelKinBtn?.addEventListener('click', closeModal);

    addKinModal?.addEventListener('click', (e) => {
        if (e.target === addKinModal) closeModal();
    });

    addKinForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        addKin();
        closeModal();
    });

    // Load Kin List from Backend
    fetchKinList();
}

// Fetch Kin List
async function fetchKinList() {
    const token = localStorage.getItem('hearthToken');
    const kinListContainer = document.getElementById('kin-list');

    if (!token) {
        console.warn('No auth token found, using static placeholder or localStorage if available');
        // Fallback for demo/mock mode if no real token
        // In a real scenario, we might hide the section or show a login prompt
        return;
    }

    try {
        const response = await fetch('/api/kin', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const kinList = await response.json();
            renderKinList(kinList);
        } else {
            console.error('Failed to fetch kin list:', await response.text());
        }
    } catch (err) {
        console.error('Error fetching kin list:', err);
    }
}

// Render Kin List
function renderKinList(kinList) {
    const container = document.getElementById('kin-list');
    if (!container) return;

    container.innerHTML = ''; // Clear placeholders

    if (kinList.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">You haven\'t added any Kin yet.</p>';
        return;
    }

    kinList.forEach(kin => {
        const card = document.createElement('div');
        card.className = 'kin-card card';

        const tierBadgeClass = kin.tier === 'inner_circle' ? 'badge-primary' : 'badge';
        const tierLabel = kin.tier === 'inner_circle' ? 'Inner Circle' : 'Kin';
        const avatar = kin.avatarUrl || '😊'; // Default avatar

        card.innerHTML = `
            <div class="kin-header">
                <div class="avatar">${avatar}</div>
                <div class="kin-info-section">
                    <h4 class="kin-name">${escapeHtml(kin.displayName)}</h4>
                    <span class="badge ${tierBadgeClass}" id="tier-badge-${kin.id}">${tierLabel}</span>
                </div>
            </div>
            <div class="kin-tier-control" style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
                <label style="font-size: 0.8rem; color: var(--text-muted);">Relationship:</label>
                <select class="input input-small tier-select" data-id="${kin.id}" style="padding: 4px; width: auto;">
                    <option value="kin" ${kin.tier === 'kin' ? 'selected' : ''}>Kin</option>
                    <option value="inner_circle" ${kin.tier === 'inner_circle' ? 'selected' : ''}>Inner Circle</option>
                </select>
            </div>
            <div class="kin-actions">
                <button class="btn btn-small message-btn" data-id="${kin.id}" data-name="${escapeHtml(kin.displayName)}">Message</button>
                <button class="btn btn-small remove-btn" data-id="${kin.id}" data-name="${escapeHtml(kin.displayName)}">Remove</button>
            </div>
        `;

        container.appendChild(card);
    });

    // Attach event listeners
    attachKinActionListeners();
}

function attachKinActionListeners() {
    // Message Buttons
    document.querySelectorAll('.message-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const kinId = e.target.getAttribute('data-id');
            const kinName = e.target.getAttribute('data-name');
            window.location.href = `parlor.html?chatWith=${kinId}&name=${encodeURIComponent(kinName)}`;
        });
    });

    // Remove Buttons
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const kinId = e.target.getAttribute('data-id');
            const kinName = e.target.getAttribute('data-name');

            if (confirm(`Are you sure you want to remove ${kinName} from your Kin?`)) {
                await removeKin(kinId, e.target.closest('.kin-card'));
            }
        });
    });

    // Tier Change
    document.querySelectorAll('.tier-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const kinId = e.target.getAttribute('data-id');
            const newTier = e.target.value;
            await changeKinTier(kinId, newTier);
        });
    });
}

// Remove Kin
async function removeKin(kinId, cardElement) {
    const token = localStorage.getItem('hearthToken');
    if (!token) return;

    try {
        const response = await fetch(`/api/kin/${kinId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            // Remove from UI
            cardElement.remove();

            // If empty, show message
            const container = document.getElementById('kin-list');
            if (container.children.length === 0) {
                container.innerHTML = '<p class="text-muted text-center">You haven\'t added any Kin yet.</p>';
            }
        } else {
            alert('Failed to remove Kin. Please try again.');
            console.error(await response.text());
        }
    } catch (err) {
        console.error('Error removing kin:', err);
    }
}

// Change Tier
async function changeKinTier(kinId, newTier) {
    const token = localStorage.getItem('hearthToken');
    if (!token) return;

    try {
        const response = await fetch(`/api/kin/${kinId}/tier`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ tier: newTier })
        });

        if (response.ok) {
            // Update UI badge
            const badge = document.getElementById(`tier-badge-${kinId}`);
            if (badge) {
                badge.textContent = newTier === 'inner_circle' ? 'Inner Circle' : 'Kin';
                badge.className = newTier === 'inner_circle' ? 'badge badge-primary' : 'badge';
            }
        } else {
            alert('Failed to update tier.');
            // Revert select?
        }
    } catch (err) {
        console.error('Error changing tier:', err);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Add Kin
function addKin() {
    const hearthKey = document.getElementById('kin-hearth-key').value.trim();
    // const tier = document.getElementById('kin-tier').value;
    // Note: Request usually doesn't set tier immediately or defaults to 'kin'.
    // The backend /request expects target_user_id, not hearthKey.
    // So we would first need to resolve HearthKey to UserID.
    // For now, let's keep the mock alert but note the limitation.

    alert(`Kin request sent to ${hearthKey}!\n\n(Note: In this demo, this is a simulation. Real implementation requires resolving HearthKey to UserID via API first.)`);
}

// Initialize additional settings
function initializeSettings() {
    const sunsetToggle = document.getElementById('setting-sunset-timer');
    const darkModeToggle = document.getElementById('setting-dark-mode');

    // Sunset Timer
    if (sunsetToggle) {
        const sunsetEnabled = localStorage.getItem('sunsetTimerEnabled') !== 'false'; // default true
        sunsetToggle.checked = sunsetEnabled;

        const startInput = document.getElementById('sunset-start');
        const endInput = document.getElementById('sunset-end');

        // Initialize inputs
        if (startInput) {
            startInput.value = localStorage.getItem('sunsetStart') || '20:00';
            startInput.addEventListener('change', (e) => {
                localStorage.setItem('sunsetStart', e.target.value);
            });
        }

        if (endInput) {
            endInput.value = localStorage.getItem('sunsetEnd') || '06:00';
            endInput.addEventListener('change', (e) => {
                localStorage.setItem('sunsetEnd', e.target.value);
            });
        }

        sunsetToggle.addEventListener('change', (e) => {
            localStorage.setItem('sunsetTimerEnabled', e.target.checked);

            // Show feedback
            alert(e.target.checked
                ? `Sunset Timer enabled! The app will dim from ${startInput.value} to ${endInput.value}.`
                : 'Sunset Timer disabled.');
        });
    }

    // Dark Mode
    if (darkModeToggle) {
        // Check current dark mode state
        const darkModeEnabled = document.documentElement.getAttribute('data-theme') === 'dark';
        darkModeToggle.checked = darkModeEnabled;

        darkModeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('darkModeEnabled', 'true');
            } else {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('darkModeEnabled', 'false');
            }
        });
    }
}

// Initialize logout
function initializeLogout() {
    const logoutBtn = document.getElementById('logout-btn-profile');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('hearthUser');
                localStorage.removeItem('hearthKey');
                localStorage.removeItem('hearthToken'); // Clear token
                window.location.href = 'index.html';
            }
        });
    }
}
