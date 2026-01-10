
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;

    if (!email || !password) {
        alert('Please enter both email and password.');
        return;
    }

    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Store user data and token
        localStorage.setItem('hearthUser', JSON.stringify(data.user));
        localStorage.setItem('hearthKey', data.user.hearthKey);
        localStorage.setItem('hearthToken', data.token);
        localStorage.setItem('isAuthenticated', 'true');

        // Restore theme if saved
        if (localStorage.getItem('darkModeEnabled') === 'true') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }

        // Redirect to main app
        window.location.href = 'app.html';

    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed: ' + error.message);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}
