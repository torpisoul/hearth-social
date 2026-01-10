(function() {
    // Immediate theme application to prevent flash
    const savedTheme = localStorage.getItem('theme');

    // Migration: Check legacy darkModeEnabled if no theme set
    if (!savedTheme) {
        const legacyDark = localStorage.getItem('darkModeEnabled');
        if (legacyDark === 'true') {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            localStorage.removeItem('darkModeEnabled');
        } else {
            // Default is Oatmeal (no attribute needed, but we can set explicit)
            // Or just leave it as is.
            // If user specifically requested Oatmeal as default, and CSS :root is Oatmeal, we are good.
        }
    } else {
        if (savedTheme !== 'oatmeal') {
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
    }
})();
