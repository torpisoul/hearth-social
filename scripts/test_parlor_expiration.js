
import { handler } from '../netlify/functions/parlor.js';
import esmock from 'esmock';
import assert from 'assert';

// Mock Supabase
const mockSupabase = {
    auth: {
        getUser: async (token) => ({
            data: { user: { id: 'test-user-id' } },
            error: null
        })
    },
    from: (table) => {
        if (table === 'parlor_messages') {
            return {
                insert: (data) => ({
                    select: () => ({
                        single: async () => ({
                            data: { ...data, id: 'msg-id', created_at: new Date().toISOString() },
                            error: null
                        })
                    })
                }),
                select: (columns) => ({
                    eq: (col, val) => ({
                        order: (col, opts) => Promise.resolve({
                            data: [
                                {
                                    id: 'msg-1',
                                    parlor_id: 'conv-id',
                                    user_id: 'test-user-id',
                                    content: 'Hello',
                                    media_url: 'http://example.com/image.jpg',
                                    media_expires_at: new Date(Date.now() - 10000).toISOString(), // Expired
                                    created_at: new Date().toISOString(),
                                    users: { display_name: 'Test User' }
                                },
                                {
                                    id: 'msg-2',
                                    parlor_id: 'conv-id',
                                    user_id: 'test-user-id',
                                    content: 'Active',
                                    media_url: 'http://example.com/image2.jpg',
                                    media_expires_at: new Date(Date.now() + 10000).toISOString(), // Active
                                    created_at: new Date().toISOString(),
                                    users: { display_name: 'Test User' }
                                }
                            ],
                            error: null
                        })
                    })
                })
            };
        }
        if (table === 'parlor_participants') {
            return {
                select: (cols) => ({
                    eq: (col, val) => ({
                        eq: (col2, val2) => ({
                            single: async () => ({ data: { id: 'part-id' }, error: null })
                        })
                    })
                })
            }
        }
        // Catch all for other tables
        return {
            select: () => ({ eq: () => ({ single: () => ({ data: {}, error: null }) }) }),
            insert: () => ({ select: () => ({ single: () => ({ data: {}, error: null }) }) })
        };
    },
    storage: {
        from: () => ({
            upload: async () => ({ data: {}, error: null }),
            getPublicUrl: (path) => ({ data: { publicUrl: `https://supa.base/${path}` } })
        })
    }
};

// Re-import handler with mock
const mockedHandler = await esmock('../netlify/functions/parlor.js', {
    '@supabase/supabase-js': {
        createClient: () => mockSupabase
    }
});

async function runTests() {
    console.log('Running Parlor Expiration Tests...');

    // Test 1: Send Message with Expiration
    console.log('Test 1: Send Message with Expiration (1h)');
    const event1 = {
        httpMethod: 'POST',
        path: '/api/conversations/conv-id/messages',
        headers: { authorization: 'Bearer test-token' },
        body: JSON.stringify({
            content: 'Test message',
            mediaUrl: 'http://example.com/img.jpg',
            expiration: '1h'
        })
    };

    const response1 = await mockedHandler.handler(event1, {});

    // Log error if 500
    if (response1.statusCode === 500) {
        console.error('500 Error Body:', response1.body);
    }

    const body1 = JSON.parse(response1.body);

    assert.strictEqual(response1.statusCode, 201);
    assert.ok(body1.media_expires_at);

    const expiresAt = new Date(body1.media_expires_at);
    const now = new Date();
    const diffHours = (expiresAt - now) / (1000 * 60 * 60);

    assert.ok(diffHours > 0.9 && diffHours < 1.1, 'Expiration should be approx 1 hour');
    console.log('✅ Test 1 Passed');

    // Test 2: Send Message with Never Expire
    console.log('Test 2: Send Message with Never Expire');
    const event2 = {
        httpMethod: 'POST',
        path: '/api/conversations/conv-id/messages',
        headers: { authorization: 'Bearer test-token' },
        body: JSON.stringify({
            content: 'Test message',
            mediaUrl: 'http://example.com/img.jpg',
            expiration: 'never'
        })
    };

    const response2 = await mockedHandler.handler(event2, {});
    const body2 = JSON.parse(response2.body);

    assert.strictEqual(response2.statusCode, 201);
    assert.strictEqual(body2.media_expires_at, null);
    console.log('✅ Test 2 Passed');

    // Test 3: Get Messages (Check Expiration Logic)
    console.log('Test 3: Get Messages (Check Expiration Logic)');
    const event3 = {
        httpMethod: 'GET',
        path: '/api/conversations/conv-id/messages',
        headers: { authorization: 'Bearer test-token' }
    };

    const response3 = await mockedHandler.handler(event3, {});
    const messages = JSON.parse(response3.body);

    assert.strictEqual(response3.statusCode, 200);
    assert.strictEqual(messages.length, 2);

    // Msg 1 should be expired
    assert.strictEqual(messages[0].mediaUrl, null, 'Expired media URL should be null');
    assert.ok(messages[0].mediaExpiresAt, 'Expired timestamp should be present');

    // Msg 2 should be active
    assert.ok(messages[1].mediaUrl, 'Active media URL should be present');

    console.log('✅ Test 3 Passed');
}

runTests().catch(e => {
    console.error('❌ Tests Failed:', e);
    process.exit(1);
});
