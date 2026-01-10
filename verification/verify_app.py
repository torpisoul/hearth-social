from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Pre-seed localStorage
        page.add_init_script("""
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("hearthUser", JSON.stringify({displayName: "Test User"}));
        """)

        page.goto("http://localhost:8000/app.html")

        # Check if page loaded (title check)
        print(f"Page title: {page.title()}")

        # Wait for pulse feed to be visible
        # This confirms app.js didn't redirect and pulse.js ran
        page.wait_for_selector("#pulse-feed")

        # Wait a bit for content
        page.wait_for_timeout(1000)

        page.screenshot(path="verification/frontend.png")
        print("Screenshot saved to verification/frontend.png")
        browser.close()

if __name__ == "__main__":
    verify_frontend()
