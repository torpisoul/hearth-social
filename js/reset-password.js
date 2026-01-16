
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    const requestResetView = document.getElementById('request-reset-view');
    const submitPasswordView = document.getElementById('submit-password-view');
    const messageView = document.getElementById('message-view');

    const requestResetForm = document.getElementById('request-reset-form');
    const submitPasswordForm = document.getElementById('submit-password-form');

    if (token) {
        requestResetView.style.display = 'none';
        submitPasswordView.style.display = 'block';
    } else {
        requestResetView.style.display = 'block';
        submitPasswordView.style.display = 'none';
    }

    if (requestResetForm) {
        requestResetForm.addEventListener('submit', handleRequestReset);
    }

    if (submitPasswordForm) {
        submitPasswordForm.addEventListener('submit', (e) => handleSubmitPassword(e, token));
    }
});

function showMessage(title, text) {
    document.getElementById('request-reset-view').style.display = 'none';
    document.getElementById('submit-password-view').style.display = 'none';
    document.getElementById('message-view').style.display = 'block';

    document.getElementById('message-title').textContent = title;
    document.getElementById('message-text').textContent = text;
}

async function handleRequestReset(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    if (!email) {
        alert('Please enter your email.');
        return;
    }

    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/reset-password-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to request reset');
        }

        showMessage('Check your Email', data.message || 'If that email exists, a reset link has been sent.');

        // For demo purposes, if debugLink is present, log it prominently
        if (data.debugLink) {
            console.log('DEBUG: Reset Link:', data.debugLink);
            alert(`DEBUG: The reset link has been logged to the console (and here): \n${data.debugLink}`);
        }

    } catch (error) {
        console.error('Request Reset Error:', error);
        alert('Error: ' + error.message);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

async function handleSubmitPassword(e, token) {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    if (newPassword !== confirmPassword) {
        alert('Passwords do not match.');
        return;
    }

    if (newPassword.length < 8) {
        alert('Password must be at least 8 characters.');
        return;
    }

    submitBtn.textContent = 'Resetting...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to reset password');
        }

        showMessage('Success!', 'Your password has been reset successfully. You can now log in.');

    } catch (error) {
        console.error('Reset Password Error:', error);
        alert('Error: ' + error.message);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}
