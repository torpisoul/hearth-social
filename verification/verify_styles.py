from playwright.sync_api import sync_playwright
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        test_html = """
        <!DOCTYPE html>
        <html>
        <head>
            <link rel="stylesheet" href="styles/design-system.css">
            <link rel="stylesheet" href="styles/components.css">
            <link rel="stylesheet" href="styles/app.css">
            <style>
                body { background-color: var(--background); padding: 50px; font-family: var(--font-family); }
                .test-section { margin-bottom: 40px; }
                h2 { margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="test-section">
                <h2>Buttons</h2>
                <button class="btn">Default Button</button>
                <button class="btn btn-primary">Primary Button</button>
                <button class="btn active">Active Button</button>
            </div>

            <div class="test-section">
                <h2>Inputs</h2>
                <input type="text" class="input" placeholder="Type here...">
            </div>

            <div class="test-section">
                <h2>Cards</h2>
                <div class="card" style="max-width: 300px;">
                    <h3>Card Title</h3>
                    <p>Card content goes here.</p>
                </div>
            </div>

            <div class="test-section">
                <h2>Pulse Actions</h2>
                <div class="pulse-actions">
                    <button class="pulse-action-btn">
                        <span>Like</span>
                    </button>
                    <button class="pulse-action-btn acknowledged">
                        <span>Liked</span>
                    </button>
                </div>
            </div>

            <div class="test-section">
                <h2>Nav Tabs</h2>
                <div class="nav-tabs" style="position: relative;">
                    <a href="#" class="nav-tab">Home</a>
                    <a href="#" class="nav-tab active">Profile</a>
                </div>
            </div>
        </body>
        </html>
        """

        with open("style_test.html", "w") as f:
            f.write(test_html)

        page.goto("file:///app/style_test.html")
        page.screenshot(path="verification/components_neumorphic.png", full_page=True)

        page.goto("file:///app/index.html")
        page.wait_for_timeout(1000)
        page.screenshot(path="verification/landing_neumorphic.png", full_page=True)

        browser.close()

        if os.path.exists("style_test.html"):
            os.remove("style_test.html")

if __name__ == "__main__":
    run_verification()
