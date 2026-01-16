import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Setup DOM
const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
        <body>
            <div id="category-filters"></div>
            <div id="pulse-feed"></div>
            <div id="new-pulse-modal" class="modal-overlay"></div>
            <form id="new-pulse-form">
                <textarea id="pulse-content"></textarea>
                <select id="pulse-visibility"></select>
                <select id="pulse-category"></select>
            </form>
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
global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));

// Mock user with preferences
let mockUser = {
    displayName: 'Test User',
    authorId: 'current-user',
    feedPreferences: []
};

global.window.getCurrentUser = vi.fn(() => mockUser);

// Import module
const pulseModule = await import('../../js/pulse.js');

describe('pulse categories', () => {
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = `
            <div id="category-filters"></div>
            <div id="pulse-feed"></div>
            <div id="new-pulse-modal" class="modal-overlay"></div>
            <form id="new-pulse-form">
                <textarea id="pulse-content"></textarea>
                <select id="pulse-visibility"></select>
                <select id="pulse-category"></select>
            </form>
            <div id="caught-up">Caught Up</div>
        `;

        vi.clearAllMocks();
        mockUser.feedPreferences = []; // Reset preferences

        // Setup initial pulses in localStorage for testing filtering
        const samplePulses = [
            { id: 'p1', authorId: 'u1', content: 'Life Post', category: 'Life', timestamp: Date.now() },
            { id: 'p2', authorId: 'u1', content: 'Tech Post', category: 'Tech', timestamp: Date.now() }
        ];
        global.localStorage.getItem.mockImplementation((key) => {
            if (key === 'hearthPulses') return JSON.stringify(samplePulses);
            return null;
        });

        // Trigger load
        pulseModule.loadPulses();
    });

    it('should show empty state if no categories selected', () => {
        const { renderPulses } = pulseModule;
        mockUser.feedPreferences = [];
        renderPulses();

        const feed = document.getElementById('pulse-feed');
        expect(feed.innerHTML).toContain('Select some categories');
        expect(feed.innerHTML).not.toContain('Life Post');
    });

    it('should show pulses matching selected categories', () => {
        const { renderPulses } = pulseModule;
        mockUser.feedPreferences = ['Life'];
        renderPulses();

        const feed = document.getElementById('pulse-feed');
        expect(feed.textContent).toContain('Life Post');
        expect(feed.textContent).not.toContain('Tech Post');
    });

    it('should show pulses for multiple categories', () => {
        const { renderPulses } = pulseModule;
        mockUser.feedPreferences = ['Life', 'Tech'];
        renderPulses();

        const feed = document.getElementById('pulse-feed');
        expect(feed.textContent).toContain('Life Post');
        expect(feed.textContent).toContain('Tech Post');
    });

    it('should render category pills correctly', () => {
        const { initializeCategoryFilters } = pulseModule;
        mockUser.feedPreferences = ['Life'];
        initializeCategoryFilters();

        const container = document.getElementById('category-filters');
        const lifePill = Array.from(container.children).find(el => el.textContent === 'Life');
        const techPill = Array.from(container.children).find(el => el.textContent === 'Tech');

        expect(lifePill.classList.contains('active')).toBe(true);
        expect(techPill.classList.contains('active')).toBe(false);
    });

    it('toggleCategoryFilter should update preferences and re-render', async () => {
        const { toggleCategoryFilter } = pulseModule;
        mockUser.feedPreferences = []; // Start empty

        await toggleCategoryFilter('Life');

        // Check if user object updated
        expect(mockUser.feedPreferences).toContain('Life');
        expect(global.localStorage.setItem).toHaveBeenCalledWith('hearthUser', expect.any(String));

        // Check feed updated
        const feed = document.getElementById('pulse-feed');
        expect(feed.textContent).toContain('Life Post');
    });
});
