// ... existing code ...
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Global setup
const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
        <body>
            <div id="conversations-list"></div>
            <div id="empty-conversations"></div>
            <div id="conversations-view"></div>
            <div id="conversation-view" style="display:none;"></div>
            <div id="conversation-name"></div>
            <div id="conversation-participants"></div>
            <div id="messages-container"></div>
            <input id="message-input" type="text" />
            <select id="media-expiration">
                <option value="never">Never</option>
            </select>
            <input type="checkbox" id="quiet-mode">
            <div id="quiet-notice"></div>
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
    removeItem: vi.fn()
};
global.sessionStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn()
};
global.window.getCurrentUser = vi.fn(() => ({
    displayName: 'Test User',
    authorId: 'current-user'
}));
global.alert = vi.fn();

const parlorModule = await import('../../js/parlor.js');

describe('parlor.js', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="conversations-list"></div>
            <div id="empty-conversations"></div>
            <div id="conversations-view"></div>
            <div id="conversation-view" style="display:none;"></div>
            <div id="conversation-name"></div>
            <div id="conversation-participants"></div>
            <div id="messages-container"></div>
            <input id="message-input" type="text" />
            <select id="media-expiration">
                <option value="never">Never</option>
            </select>
            <input type="checkbox" id="quiet-mode">
            <div id="quiet-notice" style="display:none"></div>

            <button id="new-conversation-btn"></button>
            <div id="new-conversation-modal"></div>
            <form id="new-conversation-form">
                <input type="checkbox" name="kin" value="user1">
                <input type="checkbox" name="kin" value="user2">
                <input id="conversation-name-input" value="My Group">
            </form>
            <button id="close-conversation-modal"></button>
            <button id="cancel-conversation-btn"></button>
        `;
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('sendMessage should add message to conversation', () => {
        const { sendMessage, loadConversations, openConversation } = parlorModule;

        const conversations = [{
            id: 'c1',
            participants: ['current-user', 'other'],
            participantNames: ['Test User', 'Other'],
            messages: [],
            lastActivity: Date.now(),
            unread: false
        }];
        global.localStorage.getItem.mockReturnValue(JSON.stringify(conversations));

        loadConversations();
        openConversation('c1');

        document.getElementById('message-input').value = 'Hello Test';
        sendMessage();

        expect(global.localStorage.setItem).toHaveBeenCalledWith(
            'hearthConversations',
            expect.stringContaining('Hello Test')
        );
    });

    it('createConversationListItem should render correct details', () => {
        const { createConversationListItem } = parlorModule;
        const conv = {
            id: 'c1',
            participants: ['current-user', 'other'],
            participantNames: ['Test User', 'Other'],
            messages: [{
                senderName: 'Other',
                content: 'Last message'
            }],
            lastActivity: Date.now(),
            unread: true
        };

        const el = createConversationListItem(conv);
        expect(el.querySelector('.conversation-title').textContent).toBe('Other');
    });

    it('checkPulseResponseContext should create conversation if needed', () => {
        const { checkPulseResponseContext, loadConversations } = parlorModule;

        global.sessionStorage.getItem.mockReturnValue(JSON.stringify({
            pulseId: 'p1',
            authorId: 'new-user',
            authorName: 'New User'
        }));

        global.localStorage.getItem.mockReturnValue('[]');

        loadConversations();
        checkPulseResponseContext();

        expect(global.localStorage.setItem).toHaveBeenCalledWith(
            'hearthConversations',
            expect.stringContaining('new-user')
        );
    });

    it('createNewConversation should create conv and open it', () => {
        const { createNewConversation, loadConversations } = parlorModule;

        global.localStorage.getItem.mockReturnValue('[]');
        loadConversations();

        // Select kin
        const kinCheckboxes = document.querySelectorAll('input[name="kin"]');
        kinCheckboxes[0].checked = true;

        createNewConversation();

        expect(global.localStorage.setItem).toHaveBeenCalledWith(
            'hearthConversations',
            expect.stringContaining('My Group')
        );
        expect(global.localStorage.setItem).toHaveBeenCalledWith(
            'hearthConversations',
            expect.stringContaining('user1')
        );
    });
});
