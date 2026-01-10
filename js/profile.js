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

    // Backend returns privacySettings, frontend logic used privacy. Standardize on privacySettings.
    const privacy = user.privacySettings || user.privacy || {};

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
async function savePrivacySetting(key, value) {
    const user = getCurrentUser();
    if (!user) return;

    if (!user.privacySettings) user.privacySettings = user.privacy || {};
    user.privacySettings[key] = value;
    // Keep legacy field if needed for other scripts, or clean it up.
    user.privacy = user.privacySettings;

    localStorage.setItem('hearthUser', JSON.stringify(user));
    console.log('Privacy setting saved:', key, value);

    // Persist to backend
    const token = localStorage.getItem('hearthToken');
    if (!token) return;

    try {
        const response = await fetch('/api/auth/user', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                privacySettings: user.privacySettings
            })
        });

        if (!response.ok) {
            console.error('Failed to sync privacy settings with backend');
        }
    } catch (error) {
        console.error('Error syncing privacy settings:', error);
    }
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

    const privacy = user.privacySettings || user.privacy || {};

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
async function saveLifeUpdates() {
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
    user.privacySettings = user.privacySettings || user.privacy || {};
    user.privacySettings.jobVisibility = jobVisibility;
    user.privacySettings.locationVisibility = locationVisibility;
    user.privacySettings.relationshipVisibility = relationshipVisibility;
    // Keep sync
    user.privacy = user.privacySettings;

    localStorage.setItem('hearthUser', JSON.stringify(user));

    // Visual feedback
    const saveBtn = document.getElementById('save-life-updates');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✓ Saved!';
    saveBtn.classList.add('btn-primary');

    // Persist to backend
    const token = localStorage.getItem('hearthToken');
    if (token) {
        try {
            // Include lifeUpdates data in privacySettings to persist it
            user.privacySettings.lifeUpdatesData = user.lifeUpdates;

            const response = await fetch('/api/auth/user', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    privacySettings: user.privacySettings
                })
            });

            if (!response.ok) {
                console.error('Failed to sync life updates with backend');
            }
        } catch (error) {
            console.error('Error syncing life updates:', error);
        }
    }

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
}

// Add Kin
function addKin() {
    const hearthKey = document.getElementById('kin-hearth-key').value.trim();
    const tier = document.getElementById('kin-tier').value;

    // In real app, would send request to backend
    alert(`Kin request sent!\n\nHearth Key: ${hearthKey}\nTier: ${tier}\n\nIn the full implementation, this would send a connection request to the user.`);
}

// Initialize additional settings
function initializeSettings() {
    const sunsetToggle = document.getElementById('setting-sunset-timer');
    const themeSelect = document.getElementById('setting-theme');

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

    // Theme Selector
    const themeSelect = document.getElementById('setting-theme');
    if (themeSelect) {
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'oatmeal';
        themeSelect.value = savedTheme;

        // Apply if not already applied (though theme-init.js handles this mostly)
        // If savedTheme is oatmeal, we don't set data-theme usually, but explicit is fine.
        if (savedTheme !== 'oatmeal') {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        themeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            localStorage.setItem('theme', theme);

            // Clear legacy
            localStorage.removeItem('darkModeEnabled');

            if (theme === 'oatmeal') {
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', theme);
    // Theme Selection
    if (themeSelect) {
        // Check current theme
        const currentTheme = localStorage.getItem('theme') || 'oatmeal';
        themeSelect.value = currentTheme;

        themeSelect.addEventListener('change', (e) => {
            const selectedTheme = e.target.value;

            // Apply theme
            document.documentElement.setAttribute('data-theme', selectedTheme);

            // Save preference
            localStorage.setItem('theme', selectedTheme);

            // Maintain backward compatibility for now
            if (selectedTheme === 'charcoal' || selectedTheme === 'forest') {
                localStorage.setItem('darkModeEnabled', 'true');
            } else {
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
                window.location.href = 'index.html';
            }
        });
    }
}
