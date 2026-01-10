import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Global setup
const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
    url: "http://localhost/"
});

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
};

const appModule = await import('../../js/app.js');

describe('app.js', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <button id="sunset-toggle"></button>
            <input type="checkbox" id="sunset-timer-toggle">
            <button id="logout-btn"></button>

            <button id="new-pulse-btn"></button>
            <div id="new-pulse-modal"></div>
            <button id="close-pulse-modal"></button>
            <button id="cancel-pulse-btn"></button>

            <button id="settings-btn"></button>
            <div id="settings-modal"></div>
            <button id="close-settings-modal"></button>
        `;
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Re-mock navigate since the import happens only once
        vi.spyOn(global.window, 'navigate').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('checkAuth should redirect if not authenticated', () => {
        const { checkAuth } = appModule;
        global.localStorage.getItem.mockReturnValue(null);

        const result = checkAuth();

        expect(result).toBe(false);
        expect(global.window.navigate).toHaveBeenCalledWith('index.html');
    });

    it('checkAuth should return true if authenticated', () => {
        const { checkAuth } = appModule;
        global.localStorage.getItem.mockReturnValue('true');

        const result = checkAuth();

        expect(result).toBe(true);
    });

    it('logout should clear storage and redirect', () => {
        const { logout } = appModule;

        logout();

        expect(global.localStorage.removeItem).toHaveBeenCalledWith('isAuthenticated');
        expect(global.localStorage.removeItem).toHaveBeenCalledWith('hearthUser');
        expect(global.window.navigate).toHaveBeenCalledWith('index.html');
    });

    it('getCurrentUser should return parsed user', () => {
        const { getCurrentUser } = appModule;
        global.localStorage.getItem.mockReturnValue(JSON.stringify({ displayName: 'Test' }));

        const user = getCurrentUser();
        expect(user.displayName).toBe('Test');
    });

    it('checkAndApplySunsetMode should apply class if in range', () => {
        const { checkAndApplySunsetMode } = appModule;

        global.localStorage.getItem.mockImplementation((key) => {
            if (key === 'sunsetTimerEnabled') return 'true';
            if (key === 'sunsetStart') return '20:00';
            if (key === 'sunsetEnd') return '06:00';
            return null;
        });

        // Set time to 21:00
        const date = new Date(2023, 1, 1, 21, 0, 0);
        vi.setSystemTime(date);

        checkAndApplySunsetMode();

        expect(document.body.classList.contains('sunset-active')).toBe(true);
    });

    it('checkAndApplySunsetMode should remove class if out of range', () => {
        const { checkAndApplySunsetMode } = appModule;

        global.localStorage.getItem.mockImplementation((key) => {
            if (key === 'sunsetTimerEnabled') return 'true';
            if (key === 'sunsetStart') return '20:00';
            if (key === 'sunsetEnd') return '06:00';
            return null;
        });

        // Set time to 12:00
        const date = new Date(2023, 1, 1, 12, 0, 0);
        vi.setSystemTime(date);

        checkAndApplySunsetMode();

        expect(document.body.classList.contains('sunset-active')).toBe(false);
    });

    // Test initialization logic indirectly by firing DOMContentLoaded?
    // The module listens for DOMContentLoaded.
    // We can dispatch it.
    it('should initialize modals on DOMContentLoaded', () => {
        // Dispatch DOMContentLoaded
        document.dispatchEvent(new global.window.Event('DOMContentLoaded'));

        // Check if listeners are attached (by simulating clicks)
        const modal = document.getElementById('new-pulse-modal');
        const btn = document.getElementById('new-pulse-btn');

        btn.click();
        expect(modal.classList.contains('active')).toBe(true);

        const closeBtn = document.getElementById('close-pulse-modal');
        closeBtn.click();
        expect(modal.classList.contains('active')).toBe(false);
    });
});
