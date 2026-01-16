
from playwright.sync_api import sync_playwright
import os
import json
import base64

def verify_avatar_upload():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()

        # Mock auth state
        user_data = {
            'id': 'test-user-id',
            'email': 'test@example.com',
            'displayName': 'Test User',
            'hearthKey': 'HEARTH-TEST-KEY',
            'avatarUrl': None
        }

        # Add localStorage mock
        context.add_init_script(f'''
            localStorage.setItem("isAuthenticated", "true");
            localStorage.setItem("hearthToken", "mock-token");
            localStorage.setItem("hearthUser", '{json.dumps(user_data)}');
        ''')

        page = context.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        # Route API calls
        def handle_user_patch(route):
            # Verify request
            request = route.request
            post_data = request.post_data_json

            if 'avatarData' in post_data:
                print('Intercepted avatar upload request')
                # Mock success response
                response_data = {
                    'user': {
                        **user_data,
                        'avatarUrl': post_data['avatarData'] # Echo back base64 as url for immediate display
                    }
                }
                route.fulfill(status=200, json=response_data)
            else:
                route.continue_()

        page.route('**/api/auth/user', handle_user_patch)

        # Load page (http:// protocol)
        page.goto('http://localhost:8080/profile.html')

        # Create a valid minimal JPEG image
        img_data = base64.b64decode('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwH7+AD/2Q==')

        with open('verification/test_avatar.jpg', 'wb') as f:
            f.write(img_data)

        # Set input files directly on the input element
        print('Uploading file...')
        page.set_input_files('#avatar-upload', 'verification/test_avatar.jpg')

        # Wait for avatar to change
        try:
            page.wait_for_selector('#profile-avatar img', timeout=10000)
            print('Avatar updated successfully')
            page.screenshot(path='verification/avatar_uploaded.png')
        except Exception as e:
            print(f'Avatar update failed or timed out: {e}')

        browser.close()

if __name__ == '__main__':
    verify_avatar_upload()
