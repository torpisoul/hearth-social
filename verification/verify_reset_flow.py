
from playwright.sync_api import sync_playwright

def verify_reset_password():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # 1. Verify "Forgot Password" link on login page
        print("Navigating to Login Page...")
        page.goto("http://localhost:8080/login.html")
        page.screenshot(path="verification/login_page.png")

        # Click "Forgot Password"
        forgot_password_link = page.locator("text=Forgot Password?")
        if forgot_password_link.is_visible():
             print("Found 'Forgot Password' link")
             forgot_password_link.click()
        else:
             print("ERROR: 'Forgot Password' link not found")
             browser.close()
             return

        # 2. Verify Request Reset View
        print("Navigating to Reset Password Request Page...")
        page.wait_for_url("**/reset-password.html")
        page.screenshot(path="verification/request_reset_view.png")

        # 3. Simulate Token Flow
        print("Simulating Token Flow...")
        token = "test-token-123"
        page.goto(f"http://localhost:8080/reset-password.html?token={token}")

        # 4. Verify Submit New Password View
        print("Verifying Submit Password View...")
        # Check if password fields are visible
        if page.locator("#new-password").is_visible():
             print("New Password field visible")
        else:
             print("ERROR: New Password field not visible")

        page.screenshot(path="verification/submit_password_view.png")

        browser.close()

if __name__ == "__main__":
    verify_reset_password()
