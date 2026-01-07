// Main App Logic

document.addEventListener('DOMContentLoaded', () => {
    // Initialize dark mode from localStorage
    const darkModeEnabled = localStorage.getItem('darkModeEnabled') === 'true';
    if (darkModeEnabled) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Check authentication
    checkAuth();

    // Initialize UI
    initializeModals();
    initializeSunsetTimer();
});

// Authentication Check
function checkAuth() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');

    if (!isAuthenticated || isAuthenticated !== 'true') {
        // Redirect to landing page if not authenticated
        window.location.href = 'index.html';
        return false;
    }

    return true;
}

// Modal Handlers
function initializeModals() {
    // New Pulse Modal
    const newPulseBtn = document.getElementById('new-pulse-btn');
    const newPulseModal = document.getElementById('new-pulse-modal');
    const closePulseModal = document.getElementById('close-pulse-modal');
    const cancelPulseBtn = document.getElementById('cancel-pulse-btn');

    if (newPulseBtn && newPulseModal) {
        newPulseBtn.addEventListener('click', () => {
            newPulseModal.classList.add('active');
        });

        const closeModalFn = () => {
            newPulseModal.classList.remove('active');
        };

        if (closePulseModal) closePulseModal.addEventListener('click', closeModalFn);
        if (cancelPulseBtn) cancelPulseBtn.addEventListener('click', closeModalFn);

        // Close on overlay click
        newPulseModal.addEventListener('click', (e) => {
            if (e.target === newPulseModal) {
                closeModalFn();
            }
        });
    }

    // Settings Modal
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsModal = document.getElementById('close-settings-modal');

    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('active');
        });

        const closeModalFn = () => {
            settingsModal.classList.remove('active');
        };

        if (closeSettingsModal) closeSettingsModal.addEventListener('click', closeModalFn);

        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                closeModalFn();
            }
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Logout Function
function logout() {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('hearthUser');
    localStorage.removeItem('hearthKey');
    window.location.href = 'index.html';
}

// Sunset Timer
function initializeSunsetTimer() {
    const sunsetToggleNav = document.getElementById('sunset-toggle');
    const sunsetToggleSettings = document.getElementById('sunset-timer-toggle');

    // Load saved preference
    const sunsetEnabled = localStorage.getItem('sunsetTimerEnabled') === 'true';

    if (sunsetToggleSettings) {
        sunsetToggleSettings.checked = sunsetEnabled;
    }

    // Apply sunset mode if enabled and it's evening
    checkAndApplySunsetMode();

    // Toggle handlers
    if (sunsetToggleNav) {
        sunsetToggleNav.addEventListener('click', toggleSunsetMode);
    }

    if (sunsetToggleSettings) {
        sunsetToggleSettings.addEventListener('change', (e) => {
            localStorage.setItem('sunsetTimerEnabled', e.target.checked);
            if (e.target.checked) {
                checkAndApplySunsetMode();
            } else {
                document.body.classList.remove('sunset-active');
            }
        });
    }

    // Check every 15 minutes
    setInterval(checkAndApplySunsetMode, 15 * 60 * 1000);
}

function checkAndApplySunsetMode() {
    const sunsetEnabled = localStorage.getItem('sunsetTimerEnabled') === 'true';

    if (!sunsetEnabled) {
        return;
    }

    const now = new Date();
    const hour = now.getHours();

    // Sunset mode from 8 PM to 6 AM
    if (hour >= 20 || hour < 6) {
        document.body.classList.add('sunset-active');
    } else {
        document.body.classList.remove('sunset-active');
    }
}

function toggleSunsetMode() {
    document.body.classList.toggle('sunset-active');

    // Save preference
    const isActive = document.body.classList.contains('sunset-active');
    localStorage.setItem('sunsetTimerEnabled', isActive);

    const toggle = document.getElementById('sunset-timer-toggle');
    if (toggle) {
        toggle.checked = isActive;
    }
}

// Get current user data
function getCurrentUser() {
    const userDataStr = localStorage.getItem('hearthUser');
    if (userDataStr) {
        try {
            return JSON.parse(userDataStr);
        } catch (e) {
            console.error('Failed to parse user data:', e);
            return null;
        }
    }
    return null;
}
