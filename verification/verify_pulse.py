from playwright.sync_api import sync_playwright

def verify_pulse_filters(page):
    # Mock user in localStorage
    user_data = {
        "displayName": "Test User",
        "authorId": "current-user",
        "feedPreferences": ["Tech"]
    }

    # Inject localStorage before navigation
    page.add_init_script(f"""
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('hearthUser', JSON.stringify({user_data}));
    """)

    page.goto("http://localhost:8080/app.html")

    # Wait for filters to appear
    page.wait_for_selector(".category-filters-container")

    # Check if "Tech" is active
    tech_pill = page.locator(".category-filters-container").get_by_text("Tech", exact=True)
    if "active" not in tech_pill.get_attribute("class"):
        print("Error: Tech pill should be active")

    # Check if "Life" is inactive
    life_pill = page.locator(".category-filters-container").get_by_text("Life", exact=True)
    if "active" in life_pill.get_attribute("class"):
        print("Error: Life pill should be inactive")

    # Click "Life"
    life_pill.click()

    # Wait for update (UI update is sync but transition/fetch might take time)
    page.wait_for_timeout(500)

    # Check if "Life" is now active
    if "active" not in life_pill.get_attribute("class"):
        print("Error: Life pill should become active after click")

    page.screenshot(path="verification/pulse_filters.png")
    print("Screenshot saved to verification/pulse_filters.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_pulse_filters(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
