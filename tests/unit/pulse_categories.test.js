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

        // Setup initial pulses in localStorage
        const samplePulses = [
            { id: 'p1', authorId: 'u1', content: 'Other User Life Content', category: 'Life', timestamp: Date.now() },
            { id: 'p2', authorId: 'u1', content: 'Other User Tech Content', category: 'Tech', timestamp: Date.now() },
            { id: 'p3', authorId: 'current-user', content: 'My Life Content', category: 'Life', timestamp: Date.now() },
            { id: 'p4', authorId: 'current-user', content: 'My Tech Content', category: 'Tech', timestamp: Date.now() }
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
        expect(feed.innerHTML).not.toContain('Other User Life Content');
    });

    it('should show pulses matching selected categories (excluding mine if Mine is off)', () => {
        const { renderPulses } = pulseModule;
        mockUser.feedPreferences = ['Life'];
        renderPulses();

        const feed = document.getElementById('pulse-feed');
        expect(feed.textContent).toContain('Other User Life Content');
        expect(feed.textContent).not.toContain('Other User Tech Content');
        expect(feed.textContent).not.toContain('My Life Content');
    });

    it('should show my pulses if Mine is on, regardless of category', () => {
        const { renderPulses } = pulseModule;
        mockUser.feedPreferences = ['Mine'];
        renderPulses();

        const feed = document.getElementById('pulse-feed');
        expect(feed.textContent).toContain('My Life Content');
        expect(feed.textContent).toContain('My Tech Content');
        expect(feed.textContent).not.toContain('Other User Life Content');
    });

    it('should show mine and others correctly when mixed', () => {
        const { renderPulses } = pulseModule;
        mockUser.feedPreferences = ['Mine', 'Tech'];
        renderPulses();

        const feed = document.getElementById('pulse-feed');
        expect(feed.textContent).toContain('My Life Content'); // Mine is on
        expect(feed.textContent).toContain('My Tech Content'); // Mine is on
        expect(feed.textContent).toContain('Other User Tech Content'); // Tech is on
        expect(feed.textContent).not.toContain('Other User Life Content'); // Life is off
    });

    it('should render category pills including Mine', () => {
        const { initializeCategoryFilters } = pulseModule;
        mockUser.feedPreferences = ['Mine'];
        initializeCategoryFilters();

        const container = document.getElementById('category-filters');
        const minePill = Array.from(container.children).find(el => el.textContent === 'Mine');
        const lifePill = Array.from(container.children).find(el => el.textContent === 'Life');

        expect(minePill).toBeTruthy();
        expect(minePill.classList.contains('active')).toBe(true);
        expect(lifePill.classList.contains('active')).toBe(false);
    });

    it('toggleCategoryFilter should toggle Mine', async () => {
        const { toggleCategoryFilter } = pulseModule;
        mockUser.feedPreferences = [];

        await toggleCategoryFilter('Mine');

        expect(mockUser.feedPreferences).toContain('Mine');
        const feed = document.getElementById('pulse-feed');
        expect(feed.textContent).toContain('My Life Content');
    });
});
