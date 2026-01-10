// Onboarding Flow Logic

let currentStep = 1;
const totalSteps = 5;
let userData = {
    email: '',
    password: '',
    displayName: '',
    hearthKey: '',
    privacy: {
        discoverable: false,
        readReceipts: false,
        jobVisibility: 'private',
        locationVisibility: 'private',
        relationshipVisibility: 'private',
        cloudBackup: false
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateProgress();
    initializeForms();
    generateHearthKey();
});

// Navigation functions
function nextStep(step) {
    const currentElement = document.getElementById(`step-${currentStep}`);
    const nextElement = document.getElementById(`step-${step}`);

    if (!currentElement || !nextElement) return;

    // Add exiting animation
    currentElement.classList.add('exiting');

    setTimeout(() => {
        currentElement.classList.remove('active', 'exiting');
        nextElement.classList.add('active');
        currentStep = step;
        updateProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 300);
}

function prevStep(step) {
    nextStep(step);
}

function updateProgress() {
    const progressFill = document.getElementById('progress-fill');
    const percentage = (currentStep / totalSteps) * 100;
    progressFill.style.width = `${percentage}%`;
}

// Form handlers
function initializeForms() {
    // Step 2: Signup form
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // Step 3: Name form
    const nameForm = document.getElementById('name-form');
    if (nameForm) {
        nameForm.addEventListener('submit', handleNameSubmit);
    }

    // Step 5: Copy key button
    const copyKeyBtn = document.getElementById('copy-key-btn');
    if (copyKeyBtn) {
        copyKeyBtn.addEventListener('click', copyHearthKey);
    }
}

async function handleSignup(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Basic validation
    if (password.length < 8) {
        alert('Password must be at least 8 characters long.');
        return;
    }

    if (password !== confirmPassword) {
        alert('Passwords do not match.');
        return;
    }

    // Store temporarily (in real app, this would go to Supabase)
    userData.email = email;
    userData.password = password;

    // TODO: Call authentication API when Supabase is set up
    // For now, just proceed to next step
    console.log('User created:', { email });

    nextStep(3);
}

function handleNameSubmit(e) {
    e.preventDefault();

    const displayName = document.getElementById('display-name').value;

    if (!displayName || displayName.trim().length === 0) {
        alert('Please enter a display name.');
        return;
    }

    userData.displayName = displayName;
    console.log('Display name set:', displayName);

    nextStep(4);
}

// Generate unique Hearth Key
function generateHearthKey() {
    const segments = [];
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    // Generate 2 segments of 4 characters to keep total length <= 20
    // HEARTH-XXXX-XXXX (16 chars)
    for (let i = 0; i < 2; i++) {
        let segment = '';
        for (let j = 0; j < 4; j++) {
            segment += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        segments.push(segment);
    }

    const key = `HEARTH-${segments.join('-')}`;
    userData.hearthKey = key;

    const hearthKeyElement = document.getElementById('hearth-key');
    if (hearthKeyElement) {
        hearthKeyElement.textContent = key;
    }

    return key;
}

// Copy Hearth Key to clipboard
function copyHearthKey() {
    const hearthKey = userData.hearthKey;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(hearthKey).then(() => {
            const btn = document.getElementById('copy-key-btn');
            const originalText = btn.textContent;
            btn.textContent = 'Copied! ✓';
            btn.classList.add('btn-primary');

            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('btn-primary');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            fallbackCopy();
        });
    } else {
        fallbackCopy();
    }
}

function fallbackCopy() {
    const hearthKeyElement = document.getElementById('hearth-key');
    const range = document.createRange();
    range.selectNode(hearthKeyElement);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);

    try {
        document.execCommand('copy');
        alert('Hearth Key copied to clipboard!');
    } catch (err) {
        alert('Please manually copy your Hearth Key: ' + userData.hearthKey);
    }

    window.getSelection().removeAllRanges();
}

// Complete onboarding
async function completeOnboarding() {
    // Gather all privacy settings
    userData.privacy.discoverable = document.getElementById('discoverable').checked;
    userData.privacy.readReceipts = document.getElementById('read-receipts').checked;
    userData.privacy.jobVisibility = document.getElementById('job-visibility').value;
    userData.privacy.locationVisibility = document.getElementById('location-visibility').value;
    userData.privacy.relationshipVisibility = document.getElementById('relationship-visibility').value;
    userData.privacy.cloudBackup = document.getElementById('cloud-backup').checked;

    console.log('Onboarding complete! User data:', userData);

    // Send complete user data to Supabase via Netlify Function
    const submitBtn = document.querySelector('button[onclick="completeOnboarding()"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating Account...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: userData.email,
                password: userData.password,
                displayName: userData.displayName,
                hearthKey: userData.hearthKey,
                privacySettings: userData.privacy
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        // Store user data and token
        localStorage.setItem('hearthUser', JSON.stringify(data.user));
        localStorage.setItem('hearthKey', data.user.hearthKey);
        localStorage.setItem('hearthToken', data.token);
        localStorage.setItem('isAuthenticated', 'true');

        // Redirect to main app
        window.location.href = 'app.html';

    } catch (error) {
        console.error('Registration error:', error);
        alert('Failed to create account: ' + error.message);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}
