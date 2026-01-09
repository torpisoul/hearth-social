from playwright.sync_api import sync_playwright

def verify_qr_code():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Grant permissions for clipboard if needed, though we aren't testing that directly here
        context = browser.new_context()
        page = context.new_page()

        # Navigate to the profile page
        page.goto("http://localhost:8080/profile.html")

        # Mock user data in localStorage
        page.evaluate("""() => {
            const user = {
                displayName: "Test User",
                hearthKey: "HEARTH-TEST-KEY-1234",
                privacy: {},
                lifeUpdates: {}
            };
            localStorage.setItem('hearthUser', JSON.stringify(user));
            localStorage.setItem('isAuthenticated', 'true');
        }""")

        # Reload to ensure localStorage is picked up
        page.goto("http://localhost:8080/profile.html")

        # Wait for profile name element to exist and have text
        expect_profile_name = page.locator("#profile-name")

        # Wait for profile name text to change from "Loading..."
        try:
            expect_profile_name.wait_for(state="visible", timeout=10000)
            print(f"Profile name on page: {expect_profile_name.text_content()}")
        except Exception as e:
            print(f"Error waiting for profile name: {e}")
            page.screenshot(path="verification/error_profile_name.png")
            print("Body text snippet:", page.inner_text("body")[:500])
            raise e

        # Register console listener to debug JS errors
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))

        # Click "Share via QR" button
        page.click("#share-hearth-key")

        # Wait for modal to be active
        page.wait_for_selector("#qr-modal.active")

        # Check if qr code container exists
        print("QR container HTML:", page.inner_html("#qr-code"))

        # Wait for QR code image to be generated
        # QRCode.js creates an img tag inside the container, or sometimes a canvas or table depending on options/support
        # Let's wait for any child
        try:
             page.wait_for_selector("#qr-code > *", timeout=5000)
             print("QR code content generated.")
        except:
             print("QR code content NOT generated.")
             page.screenshot(path="verification/error_qr_generation.png")

        # Wait for Download button
        page.wait_for_selector("#download-qr-btn")

        # Take screenshot
        page.screenshot(path="verification/qr_code_verification.png")

        browser.close()

if __name__ == "__main__":
    verify_qr_code()
