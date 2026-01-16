from playwright.sync_api import sync_playwright
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # We need to mock auth to see app.html content usually,
        # but the bottom nav might be visible even if content is empty or redirects?
        # Actually app.js might redirect.
        # Let's try to mock localStorage if needed.

        # Inject local storage
        page.add_init_script("""
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('hearthToken', 'mock-token');
            localStorage.setItem('hearthUser', JSON.stringify({id: 'mock-user', name: 'Mock User'}));
        """)

        page.goto("file:///app/app.html")
        page.wait_for_timeout(1000) # Wait for js to render
        page.screenshot(path="verification/app_nav.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    run_verification()
