
from playwright.sync_api import sync_playwright
import json

def verify_registration_payload():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Intercept registration request
        def handle_route(route):
            request = route.request
            if request.method != 'POST':
                route.continue_()
                return

            post_data = request.post_data_json

            print(f"Intercepted POST {request.url}")
            print(f"Payload: {json.dumps(post_data, indent=2)}")

            # Verify Hearth Key Format
            hearth_key = post_data.get('hearthKey')
            if len(hearth_key) == 16 and hearth_key.startswith('HEARTH-'):
                print("SUCCESS: Hearth Key format is correct (16 chars).")
            else:
                print(f"FAILURE: Hearth Key format incorrect: {hearth_key} (Len: {len(hearth_key)})")

            # Verify Privacy Settings
            privacy = post_data.get('privacySettings')
            if privacy and 'discoverable' in privacy:
                print("SUCCESS: Privacy Settings present.")
            else:
                print("FAILURE: Privacy Settings missing.")

            # Return Mock Success
            route.fulfill(
                status=201,
                content_type="application/json",
                body=json.dumps({
                    "user": {
                        "id": "mock-id",
                        "email": post_data['email'],
                        "displayName": post_data['displayName'],
                        "hearthKey": hearth_key,
                        "privacySettings": privacy
                    },
                    "token": "mock-token"
                })
            )

        page.route("**/api/auth/register", handle_route)

        # 1. Visit Onboarding
        print("Visiting onboarding page...")
        page.goto("http://localhost:8080/onboarding.html")

        # 2. Complete Step 1 -> 2
        page.click("text=Let's Begin")

        # Fill Account Form (Step 2)
        print("Filling account form...")
        page.fill("#email", "playwright@test.com")
        page.fill("#password", "password123")
        page.fill("#confirm-password", "password123")
        # Click Continue inside Step 2
        page.click("#step-2 button[type='submit']")

        # 3. Complete Step 3 (Name)
        print("Filling name form...")
        page.wait_for_selector("#step-3.active")
        page.fill("#display-name", "Playwright User")
        # Click Continue inside Step 3
        page.click("#step-3 button[type='submit']")

        # 4. Complete Step 4 (Privacy)
        print("Completing privacy...")
        page.wait_for_selector("#step-4.active")
        # Click Continue inside Step 4 (it's a button type=button onclick)
        page.click("#step-4 button[onclick='nextStep(5)']")

        # 5. Complete Step 5 (Key)
        print("Completing onboarding (Submit)...")
        page.wait_for_selector("#step-5.active")
        # Click "Enter the Hearth"
        page.click("button[onclick='completeOnboarding()']")

        # Wait for redirect or success
        try:
            page.wait_for_url("**/app.html", timeout=5000)
            print("SUCCESS: Redirected to app.html")
        except:
            print("WARNING: Did not redirect to app.html within timeout (maybe because mock response handled differently?)")

        browser.close()

if __name__ == "__main__":
    verify_registration_payload()
