
from playwright.sync_api import sync_playwright

def verify_theme_switching():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create context to simulate local storage persistence
        context = browser.new_context()
        page = context.new_page()

        # 1. Login first to get to profile (auth check)
        # Or mock storage. Let's mock storage for auth.
        context.add_init_script("""
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('hearthUser', JSON.stringify({displayName: 'Tester', hearthKey: 'KEY'}));
        """)

        # 2. Visit Profile Page
        print("Visiting profile page...")
        page.goto("http://localhost:8080/profile.html")

        # Check default theme (Oatmeal - no data-theme)
        html_attr = page.get_attribute("html", "data-theme")
        if html_attr is None or html_attr == "":
            print("Default theme is Oatmeal (no data-theme).")
        else:
            print(f"Default theme is: {html_attr}")

        page.screenshot(path="verification/theme_default.png")

        # 3. Select Clay Theme
        print("Selecting Clay theme...")
        page.select_option("#setting-theme", "clay")

        # Verify persistence and attribute change
        html_attr = page.get_attribute("html", "data-theme")
        if html_attr == "clay":
            print("Theme changed to Clay successfully.")
        else:
            print(f"Theme FAILED to change. Current: {html_attr}")

        page.screenshot(path="verification/theme_clay.png")

        # 4. Reload page to verify persistence (via theme-init.js)
        print("Reloading page...")
        page.reload()

        html_attr = page.get_attribute("html", "data-theme")
        if html_attr == "clay":
            print("Theme persisted as Clay after reload.")
        else:
            print(f"Theme persistence FAILED. Current: {html_attr}")

        page.screenshot(path="verification/theme_persisted.png")

        browser.close()

if __name__ == "__main__":
    verify_theme_switching()
