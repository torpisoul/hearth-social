// Parlor (Messaging) Logic

let conversations = [];
let currentConversationId = null;
let quietModeEnabled = true;

document.addEventListener('DOMContentLoaded', () => {
    initializeQuietMode();
    loadConversations();
    initializeConversationModal();
    initializeMessageForm();

    // Check for conversation context from Pulse response
    checkPulseResponseContext();
});

// Initialize Quiet Mode
function initializeQuietMode() {
    const quietToggle = document.getElementById('quiet-mode');
    const quietNotice = document.getElementById('quiet-notice');

    // Load preference
    quietModeEnabled = localStorage.getItem('quietModeEnabled') !== 'false';

    if (quietToggle) {
        quietToggle.checked = quietModeEnabled;

        quietToggle.addEventListener('change', (e) => {
            quietModeEnabled = e.target.checked;
            localStorage.setItem('quietModeEnabled', quietModeEnabled);

            if (quietNotice) {
                quietNotice.style.display = quietModeEnabled ? 'flex' : 'none';
            }
        });
    }

    if (quietNotice) {
        quietNotice.style.display = quietModeEnabled ? 'flex' : 'none';
    }
}

// Load conversations from localStorage
function loadConversations() {
    const saved = localStorage.getItem('hearthConversations');

    if (saved) {
        try {
            conversations = JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse conversations:', e);
            conversations = getSampleConversations();
        }
    } else {
        conversations = getSampleConversations();
    }

    renderConversationsList();
}

// Sample conversations for demo
function getSampleConversations() {
    const currentUser = getCurrentUser();
    const userName = currentUser ? currentUser.displayName : 'You';

    return [
        {
            id: 'conv-1',
            participants: ['current-user', 'demo-user-1'],
            participantNames: [userName, 'Jamie'],
            name: null,
            messages: [
                {
                    id: 'msg-1',
                    senderId: 'demo-user-1',
                    senderName: 'Jamie',
                    content: "Hey! How's it going?",
                    timestamp: Date.now() - 3600000,
                    mediaUrl: null
                },
                {
                    id: 'msg-2',
                    senderId: 'current-user',
                    senderName: userName,
                    content: "Pretty good! Just setting up my Hearth space. This is so much better than other platforms.",
                    timestamp: Date.now() - 3000000,
                    mediaUrl: null
                }
            ],
            lastActivity: Date.now() - 3000000,
            unread: false
        },
        {
            id: 'conv-2',
            participants: ['current-user', 'demo-user-2'],
            participantNames: [userName, 'Alex'],
            name: 'Weekend Plans',
            messages: [
                {
                    id: 'msg-3',
                    senderId: 'demo-user-2',
                    senderName: 'Alex',
                    content: "Want to grab coffee this weekend?",
                    timestamp: Date.now() - 7200000,
                    mediaUrl: null
                }
            ],
            lastActivity: Date.now() - 7200000,
            unread: true
        }
    ];
}

// Render conversations list
function renderConversationsList() {
    const listContainer = document.getElementById('conversations-list');
    const emptyState = document.getElementById('empty-conversations');

    if (!listContainer) return;

    if (conversations.length === 0) {
        listContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    listContainer.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';

    // Sort by last activity
    const sorted = [...conversations].sort((a, b) => b.lastActivity - a.lastActivity);

    listContainer.innerHTML = '';

    sorted.forEach(conv => {
        const item = createConversationListItem(conv);
        listContainer.appendChild(item);
    });
}

// Create conversation list item
function createConversationListItem(conv) {
    const div = document.createElement('div');
    div.className = `conversation-item card ${conv.unread ? 'unread' : ''}`;
    div.onclick = () => openConversation(conv.id);

    const otherParticipants = conv.participantNames.filter(name => {
        const currentUser = getCurrentUser();
        return name !== (currentUser ? currentUser.displayName : 'You');
    });

    const displayName = conv.name || otherParticipants.join(', ');
    const lastMessage = conv.messages[conv.messages.length - 1];

    div.innerHTML = `
    <div class="conversation-header-item">
      <div>
        <div class="conversation-participants-list">
          ${conv.participants.slice(0, 3).map(id => `
            <div class="conversation-participant-avatar">${getAvatarEmoji(id)}</div>
          `).join('')}
        </div>
      </div>
      <span class="conversation-time">${getRelativeTime(conv.lastActivity)}</span>
    </div>
    <h4 class="conversation-title">${displayName}</h4>
    <p class="conversation-preview ${conv.unread ? 'unread' : ''}">
      ${lastMessage ? `${lastMessage.senderName}: ${lastMessage.content}` : 'No messages yet'}
    </p>
  `;

    return div;
}

// Open conversation thread
function openConversation(conversationId) {
    currentConversationId = conversationId;
    const conversation = conversations.find(c => c.id === conversationId);

    if (!conversation) return;

    // Mark as read
    conversation.unread = false;
    saveConversations();

    // Switch views
    document.getElementById('conversations-view').style.display = 'none';
    document.getElementById('conversation-view').style.display = 'block';

    // Update header
    const otherParticipants = conversation.participantNames.filter(name => {
        const currentUser = getCurrentUser();
        return name !== (currentUser ? currentUser.displayName : 'You');
    });

    const displayName = conversation.name || otherParticipants.join(', ');
    document.getElementById('conversation-name').textContent = displayName;
    document.getElementById('conversation-participants').textContent =
        `${conversation.participants.length} participant${conversation.participants.length > 1 ? 's' : ''}`;

    // Render messages
    renderMessages(conversation);

    // Scroll to bottom
    setTimeout(() => {
        const container = document.getElementById('messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, 100);
}

// Render messages in conversation
function renderMessages(conversation) {
    const container = document.getElementById('messages-container');
    if (!container) return;

    const currentUser = getCurrentUser();
    const currentUserId = 'current-user';

    container.innerHTML = '';

    conversation.messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.senderId === currentUserId ? 'own-message' : ''}`;

        div.innerHTML = `
      <div class="message-avatar">${getAvatarEmoji(msg.senderId)}</div>
      <div class="message-content">
        <div class="message-bubble">
          <p class="message-text">${escapeHtml(msg.content)}</p>
          ${msg.mediaUrl ? `
            <div class="message-media">
              <img src="${msg.mediaUrl}" alt="Shared media">
            </div>
          ` : ''}
        </div>
        <div class="message-meta">
          ${msg.senderId !== currentUserId ? `<span class="message-author">${msg.senderName}</span>` : ''}
          <span class="message-time">${getRelativeTime(msg.timestamp)}</span>
        </div>
      </div>
    `;

        container.appendChild(div);
    });
}

// Back to conversations list
document.getElementById('back-to-conversations')?.addEventListener('click', () => {
    document.getElementById('conversation-view').style.display = 'none';
    document.getElementById('conversations-view').style.display = 'block';
    currentConversationId = null;
    renderConversationsList();
});

// Initialize message form
function initializeMessageForm() {
    const form = document.getElementById('message-form');
    const mediaUpload = document.getElementById('media-upload');
    const mediaPreview = document.getElementById('media-preview');
    const mediaPreviewImg = document.getElementById('media-preview-img');
    const removeMediaBtn = document.getElementById('remove-media');

    let selectedMedia = null;

    if (mediaUpload) {
        mediaUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                selectedMedia = e.target.result;
                if (mediaPreviewImg) mediaPreviewImg.src = selectedMedia;
                if (mediaPreview) mediaPreview.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        });
    }

    if (removeMediaBtn) {
        removeMediaBtn.addEventListener('click', () => {
            selectedMedia = null;
            if (mediaUpload) mediaUpload.value = '';
            if (mediaPreview) mediaPreview.style.display = 'none';
        });
    }

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            sendMessage(selectedMedia);
            // Reset after send
            selectedMedia = null;
            if (mediaUpload) mediaUpload.value = '';
            if (mediaPreview) mediaPreview.style.display = 'none';
        });
    }
}

// Send message
function sendMessage(mediaUrl = null) {
    const input = document.getElementById('message-input');
    const content = input.value.trim();

    if (!content && !mediaUrl) return;
    if (!currentConversationId) return;

    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) return;

    const currentUser = getCurrentUser();
    const newMessage = {
        id: `msg-${Date.now()}`,
        senderId: 'current-user',
        senderName: currentUser ? currentUser.displayName : 'You',
        content: content,
        timestamp: Date.now(),
        mediaUrl: mediaUrl
    };

    conversation.messages.push(newMessage);
    conversation.lastActivity = Date.now();

    saveConversations();
    renderMessages(conversation);

    input.value = '';

    // Scroll to bottom
    setTimeout(() => {
        const container = document.getElementById('messages-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, 50);
}

// New conversation modal
function initializeConversationModal() {
    const newConvBtn = document.getElementById('new-conversation-btn');
    const modal = document.getElementById('new-conversation-modal');
    const closeBtn = document.getElementById('close-conversation-modal');
    const cancelBtn = document.getElementById('cancel-conversation-btn');
    const form = document.getElementById('new-conversation-form');

    const openModal = () => modal?.classList.add('active');
    const closeModal = () => {
        modal?.classList.remove('active');
        form?.reset();
    };

    newConvBtn?.addEventListener('click', openModal);
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        createNewConversation();
        closeModal();
    });
}

// Create new conversation
function createNewConversation() {
    const selectedKin = Array.from(document.querySelectorAll('input[name="kin"]:checked'))
        .map(cb => cb.value);

    if (selectedKin.length === 0) {
        alert('Please select at least one person to start a conversation.');
        return;
    }

    const nameInput = document.getElementById('conversation-name-input');
    const conversationName = nameInput?.value.trim() || null;

    const currentUser = getCurrentUser();
    const participants = ['current-user', ...selectedKin];
    const participantNames = [
        currentUser ? currentUser.displayName : 'You',
        ...selectedKin.map(id => {
            if (id === 'demo-user-1') return 'Jamie';
            if (id === 'demo-user-2') return 'Alex';
            return 'Unknown';
        })
    ];

    const newConversation = {
        id: `conv-${Date.now()}`,
        participants,
        participantNames,
        name: conversationName,
        messages: [],
        lastActivity: Date.now(),
        unread: false
    };

    conversations.push(newConversation);
    saveConversations();
    renderConversationsList();

    // Open the new conversation
    openConversation(newConversation.id);
}

// Save conversations to localStorage
function saveConversations() {
    localStorage.setItem('hearthConversations', JSON.stringify(conversations));
}

// Check for Pulse response context
function checkPulseResponseContext() {
    const context = sessionStorage.getItem('pulseResponseContext');
    if (!context) return;

    try {
        const { pulseId, authorId, authorName } = JSON.parse(context);
        sessionStorage.removeItem('pulseResponseContext');

        // Find or create conversation with this person
        let conversation = conversations.find(c =>
            c.participants.includes(authorId) && c.participants.length === 2
        );

        if (!conversation) {
            // Create new 1-on-1 conversation
            const currentUser = getCurrentUser();
            conversation = {
                id: `conv-${Date.now()}`,
                participants: ['current-user', authorId],
                participantNames: [currentUser ? currentUser.displayName : 'You', authorName],
                name: null,
                messages: [],
                lastActivity: Date.now(),
                unread: false
            };
            conversations.push(conversation);
            saveConversations();
        }

        openConversation(conversation.id);
    } catch (e) {
        console.error('Failed to process Pulse response context:', e);
    }
}

// Helper: Get avatar emoji
function getAvatarEmoji(userId) {
    const avatars = {
        'current-user': '😊',
        'demo-user-1': '🌻',
        'demo-user-2': '🍃'
    };
    return avatars[userId] || '👤';
}

// Helper: Get relative time
function getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

// Helper: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
