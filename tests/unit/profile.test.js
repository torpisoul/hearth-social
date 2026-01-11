// ... existing code ...
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
global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
global.window.getCurrentUser = vi.fn(() => ({
    displayName: 'Test User',
    hearthKey: 'KEY-123',
    privacySettings: {},
    lifeUpdates: {}
}));
global.window.QRCode = vi.fn();
global.window.QRCode.CorrectLevel = { H: 1 };
vi.stubGlobal('QRCode', global.window.QRCode);

global.alert = vi.fn();
global.confirm = vi.fn();

// Stub navigator
const mockClipboard = { writeText: vi.fn(() => Promise.resolve()) };
Object.defineProperty(global.window.navigator, 'clipboard', {
    value: mockClipboard,
    configurable: true
});
vi.stubGlobal('navigator', global.window.navigator);

const profileModule = await import('../../js/profile.js');

describe('profile.js', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="profile-name"></div>
            <div id="profile-hearth-key"></div>

            <input type="checkbox" id="setting-discoverable">
            <input type="checkbox" id="setting-read-receipts">
            <input type="checkbox" id="setting-cloud-backup">

            <input type="text" id="job-value">
            <input type="text" id="location-value">
            <select id="relationship-value">
                <option value="">None</option>
            </select>

            <select id="job-visibility">
                <option value="private">Private</option>
                <option value="all-kin">All Kin</option>
            </select>
            <select id="location-visibility">
                <option value="private">Private</option>
                <option value="all-kin">All Kin</option>
            </select>
            <select id="relationship-visibility">
                <option value="private">Private</option>
                <option value="all-kin">All Kin</option>
            </select>

            <button id="save-life-updates">Save</button>
            <button id="copy-hearth-key">Copy</button>

            <div id="qr-code"></div>
            <button id="download-qr-btn">Download</button>

            <button id="add-kin-btn">Add Kin</button>
            <div id="add-kin-modal"></div>
            <form id="add-kin-form">
                <input id="kin-hearth-key" value="TEST-KEY">
                <select id="kin-tier"><option value="kin">Kin</option></select>
            </form>
            <button id="close-add-kin-modal"></button>
            <button id="cancel-add-kin"></button>

            <select id="setting-theme">
                <option value="oatmeal">Oatmeal</option>
                <option value="clay">Clay</option>
            </select>
            <input type="checkbox" id="setting-sunset-timer">
            <input type="time" id="sunset-start">
            <input type="time" id="sunset-end">
            <button id="logout-btn-profile">Logout</button>
        `;
        vi.clearAllMocks();
    });

    it('loadProfile should display user info', () => {
        const { loadProfile } = profileModule;
        loadProfile();
        expect(document.getElementById('profile-name').textContent).toBe('Test User');
    });

    it('saveLifeUpdates should save to localStorage and backend', async () => {
        const { saveLifeUpdates } = profileModule;

        document.getElementById('job-value').value = 'New Job';

        await saveLifeUpdates();

        expect(global.localStorage.setItem).toHaveBeenCalledWith(
            'hearthUser',
            expect.stringContaining('New Job')
        );
    });

    it('savePrivacySetting should update user and call backend', async () => {
        const { savePrivacySetting } = profileModule;
        global.localStorage.getItem.mockReturnValue('fake-token');

        await savePrivacySetting('readReceipts', true);

        expect(global.fetch).toHaveBeenCalledWith(
            '/api/auth/user',
            expect.objectContaining({
                method: 'PATCH',
                body: expect.stringContaining('"readReceipts":true')
            })
        );
    });

    it('copyHearthKey should copy to clipboard', async () => {
        const { copyHearthKey } = profileModule;

        await copyHearthKey();

        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('KEY-123');
    });

    it('showQRCode should generate QR code', () => {
        const { showQRCode } = profileModule;

        showQRCode();

        expect(global.window.QRCode).toHaveBeenCalled();
        const container = document.getElementById('qr-code');
        expect(global.window.QRCode).toHaveBeenCalledWith(container, expect.anything());
    });

    it('addKin should alert success (mock)', () => {
        const { addKin } = profileModule;

        addKin();

        expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Kin request sent'));
    });

    it('initializeSettings should setup listeners', () => {
        const { initializeSettings } = profileModule;

        initializeSettings();

        // Change theme
        const themeSelect = document.getElementById('setting-theme');
        themeSelect.value = 'clay';
        themeSelect.dispatchEvent(new global.window.Event('change'));

        expect(global.localStorage.setItem).toHaveBeenCalledWith('theme', 'clay');
        expect(document.documentElement.getAttribute('data-theme')).toBe('clay');
    });

    it('initializeLogout should handle logout confirmation', () => {
        const { initializeLogout } = profileModule;
        initializeLogout();

        const logoutBtn = document.getElementById('logout-btn-profile');
        global.confirm.mockReturnValue(true);

        logoutBtn.click();

        expect(global.confirm).toHaveBeenCalled();
        expect(global.localStorage.removeItem).toHaveBeenCalledWith('isAuthenticated');
    });

    it('initializeSettings should handle sunset timer updates', () => {
        const { initializeSettings } = profileModule;
        initializeSettings();

        const startInput = document.getElementById('sunset-start');
        startInput.value = '21:00';
        startInput.dispatchEvent(new dom.window.Event('change'));

        expect(global.localStorage.setItem).toHaveBeenCalledWith('sunsetStart', '21:00');

        const toggle = document.getElementById('setting-sunset-timer');
        toggle.checked = true;
        toggle.dispatchEvent(new dom.window.Event('change'));

        expect(global.localStorage.setItem).toHaveBeenCalledWith('sunsetTimerEnabled', true);
    });

    it('initializePrivacyControls should attach listeners', () => {
        const { initializePrivacyControls } = profileModule;

        initializePrivacyControls();

        const toggle = document.getElementById('setting-read-receipts');
        toggle.checked = true;
        toggle.dispatchEvent(new dom.window.Event('change'));

        expect(global.fetch).toHaveBeenCalled();
    });

    it('initializeKinManagement should handle modal logic', () => {
        const { initializeKinManagement } = profileModule;
        initializeKinManagement();

        const openBtn = document.getElementById('add-kin-btn');
        const modal = document.getElementById('add-kin-modal');
        const closeBtn = document.getElementById('close-add-kin-modal');

        openBtn.click();
        expect(modal.classList.contains('active')).toBe(true);

        closeBtn.click();
        expect(modal.classList.contains('active')).toBe(false);
    });

    it('initializeLifeUpdates should populate inputs', () => {
        const { initializeLifeUpdates } = profileModule;

        global.window.getCurrentUser.mockReturnValue({
            displayName: 'Test',
            lifeUpdates: { job: 'Engineer', location: 'Home' },
            privacySettings: { jobVisibility: 'all-kin' }
        });

        initializeLifeUpdates();

        expect(document.getElementById('job-value').value).toBe('Engineer');
        expect(document.getElementById('job-visibility').value).toBe('all-kin');
    });
});
