from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        # Pre-set localStorage to simulate logged-in state
        context.add_init_script("""
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('hearthUser', JSON.stringify({displayName: 'Test User'}));
        """)

        page = context.new_page()

        # Capture logs
        page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser Error: {err}"))

        page.goto("http://localhost:8080/app.html")

        # 1. Verify Feed has Category Badges (from Sample Data)
        # Wait for feed to load
        expect(page.locator('.pulse-item').first).to_be_visible()

        # Check for category badges
        expect(page.locator('.badge-category', has_text='Life')).to_be_visible()

        print("Initial feed verification passed.")

        # Take screenshot of feed
        page.screenshot(path="verification/feed_initial.png")

        # 2. Verify Create Pulse Modal has Category Selector
        page.click('#new-pulse-btn')
        expect(page.locator('#new-pulse-modal')).to_be_visible()

        # Check selector
        category_select = page.locator('#pulse-category')
        expect(category_select).to_be_visible()

        # Take screenshot of modal
        page.screenshot(path="verification/create_modal.png")
        print("Modal verification passed.")

        # 3. Create a new pulse with 'nature' category
        page.fill('#pulse-content', 'This is a test pulse about nature.')
        category_select.select_option('nature')
        page.select_option('#pulse-visibility', 'all-kin')

        print("Submitting form...")
        page.click('button[type="submit"]')

        # Verify modal closed
        expect(page.locator('#new-pulse-modal')).not_to_be_visible()

        # Verify new pulse appears with 'NATURE' badge
        new_pulse = page.locator('.pulse-item', has_text='This is a test pulse about nature.')
        expect(new_pulse).to_be_visible()

        # Check its badge
        badge = new_pulse.locator('.badge-category')
        expect(badge).to_have_text('Nature', ignore_case=True)

        print("New pulse verification passed.")

        # Take final screenshot
        page.screenshot(path="verification/feed_after_post.png")

        browser.close()

if __name__ == "__main__":
    run()
