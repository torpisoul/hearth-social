import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// We need to setup global environment BEFORE importing the module
// because top-level code in the module expects 'document' and 'window'
const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
        <body>
            <div id="pulse-feed"></div>
            <form id="new-pulse-form">
                <textarea id="pulse-content"></textarea>
                <select id="pulse-visibility">
                    <option value="all-kin">All Kin</option>
                    <option value="inner-circle">Inner Circle</option>
                    <option value="private">Private</option>
                </select>
            </form>
            <div id="new-pulse-modal" class="modal-overlay"></div>
            <div id="caught-up">Caught Up</div>
        </body>
    </html>
`, {
    url: "http://localhost/"
});

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
};
global.sessionStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
};
global.alert = vi.fn();
global.window.getCurrentUser = vi.fn(() => ({
    displayName: 'Test User',
    authorId: 'current-user'
}));

// Now import the module
// We use dynamic import to ensure globals are set
const pulseModule = await import('../../js/pulse.js');

describe('pulse.js', () => {
    beforeEach(() => {
        // Reset DOM for each test if needed
        // But since we imported the module once, top-level listeners are already attached.
        // We might need to manually reset DOM content.
        document.body.innerHTML = `
            <div id="pulse-feed"></div>
            <form id="new-pulse-form">
                <textarea id="pulse-content"></textarea>
                <select id="pulse-visibility">
                    <option value="all-kin">All Kin</option>
                    <option value="inner-circle">Inner Circle</option>
                    <option value="private">Private</option>
                </select>
            </form>
            <div id="new-pulse-modal" class="modal-overlay"></div>
            <div id="caught-up">Caught Up</div>
        `;

        vi.clearAllMocks();
    });

    it('getRelativeTime should return correct relative time strings', () => {
        const { getRelativeTime } = pulseModule;
        const now = Date.now();

        expect(getRelativeTime(now - 1000)).toBe('Just now');
        expect(getRelativeTime(now - 60000)).toBe('1 minute ago');
        expect(getRelativeTime(now - 3600000)).toBe('1 hour ago');
        expect(getRelativeTime(now - 86400000)).toBe('1 day ago');
    });

    it('escapeHtml should escape special characters', () => {
        const { escapeHtml } = pulseModule;
        const unsafe = '<script>alert("xss")</script>';
        const escaped = escapeHtml(unsafe);

        expect(escaped).not.toContain('<script>');
        expect(escaped).toContain('&lt;script&gt;');
    });

    it('createPulseElement should create correct DOM structure', () => {
        const { createPulseElement } = pulseModule;
        const pulse = {
            id: 'p1',
            author: 'Test Author',
            authorId: 'u1',
            content: 'Hello World',
            visibility: 'all-kin',
            timestamp: Date.now(),
            acknowledgedBy: []
        };

        const el = createPulseElement(pulse);

        expect(el.className).toContain('pulse-item');
        expect(el.dataset.pulseId).toBe('p1');
        expect(el.querySelector('.author-name').textContent).toBe('Test Author');
    });

    it('handleNewPulse should create a pulse and save to localStorage', async () => {
        const { handleNewPulse } = pulseModule;

        // Setup form inputs
        document.getElementById('pulse-content').value = 'My New Pulse';
        document.getElementById('pulse-visibility').value = 'inner-circle';

        // Mock event
        const event = { preventDefault: vi.fn() };

        // Call handler
        await handleNewPulse(event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(global.localStorage.setItem).toHaveBeenCalledWith(
            'hearthPulses',
            expect.stringContaining('My New Pulse')
        );

        // Check DOM update via renderPulses
        const feed = document.getElementById('pulse-feed');
        expect(feed.textContent).toContain('My New Pulse');
    });

    it('acknowledgePulse should toggle acknowledgment', () => {
        const { acknowledgePulse, renderPulses } = pulseModule;

        // Add a pulse first
        const event = { preventDefault: vi.fn() };
        document.getElementById('pulse-content').value = 'Pulse to Ack';
        pulseModule.handleNewPulse(event);

        // Find the pulse ID from the feed
        const feed = document.getElementById('pulse-feed');
        const pulseEl = feed.querySelector('.pulse-item');
        const pulseId = pulseEl.dataset.pulseId;

        // Call acknowledge
        acknowledgePulse(pulseId);

        expect(global.localStorage.setItem).toHaveBeenCalledWith(
            'acknowledgedPulses',
            expect.stringContaining(pulseId)
        );
    });
});
