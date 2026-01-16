from playwright.sync_api import sync_playwright

def verify_reset_password_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the reset password page
        page.goto("http://localhost:8080/reset-password.html")

        # Take a screenshot of the initial state
        page.screenshot(path="verification/reset_password_initial.png")
        print("Initial state screenshot captured.")

        # Fill in the email
        page.fill("#email", "test@example.com")

        # Mock the API response to avoid actual backend call (since we are testing UI logic removal)
        # We need to verify that NO console log appears with the link.

        # Monitor console logs
        console_logs = []
        page.on("console", lambda msg: console_logs.append(msg.text))

        # Intercept the request to return a success message without debugLink
        page.route("**/api/auth/reset-password-request", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"message": "If that email exists, a reset link has been sent."}'
        ))

        # Click the submit button
        page.click("button[type='submit']")

        # Wait for the message view to appear
        page.wait_for_selector("#message-view", state="visible")

        # Take a screenshot of the success state
        page.screenshot(path="verification/reset_password_success.png")
        print("Success state screenshot captured.")

        # Verify that no console log contains "reset-password.html?token="
        for log in console_logs:
            if "reset-password.html?token=" in log:
                print("FAILURE: Reset link found in console logs!")
                exit(1)

        print("SUCCESS: No reset link found in console logs.")

        browser.close()

if __name__ == "__main__":
    verify_reset_password_ui()
