
from playwright.sync_api import sync_playwright

def verify_login_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Visit Home Page
        print("Visiting home page...")
        page.goto("http://localhost:8080/index.html")

        # Check "Log In" link
        login_link = page.get_by_text("Log In").first
        if login_link.is_visible():
            print("Log In link found on home page.")
        else:
            print("Log In link NOT found on home page.")

        page.screenshot(path="verification/home_page.png")

        # 2. Click Log In
        login_link.click()

        # 3. Check Login Page
        print("Visiting login page...")
        page.wait_for_url("**/login.html")

        if page.get_by_role("heading", name="Welcome Back").is_visible():
            print("Login page loaded correctly.")
        else:
            print("Login page NOT loaded correctly.")

        page.screenshot(path="verification/login_page.png")

        # 4. Fill Form (Mock)
        page.fill("#email", "test@example.com")
        page.fill("#password", "password123")
        page.screenshot(path="verification/login_filled.png")

        browser.close()

if __name__ == "__main__":
    verify_login_page()
