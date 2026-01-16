
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { authLogic } = require('../netlify/functions/auth.cjs');
import assert from 'assert';

// Mock Supabase
const createMockSupabase = () => {
    const store = {
        users: []
    };

    return {
        from: (table) => {
            if (table !== 'users') throw new Error(`Unknown table ${table}`);
            return {
                select: (columns) => {
                    return {
                        eq: (field, value) => {
                            return {
                                single: async () => {
                                    const user = store.users.find(u => u[field] === value);
                                    return { data: user || null, error: null };
                                }
                            };
                        }
                    };
                },
                insert: (data) => {
                    return {
                        select: () => {
                            return {
                                single: async () => {
                                    const newUser = { ...data[0], id: 'user-' + Date.now() };
                                    store.users.push(newUser);
                                    return { data: newUser, error: null };
                                }
                            };
                        }
                    };
                },
                update: (data) => {
                    return {
                        eq: (field, value) => {
                            return {
                                select: () => {
                                    return {
                                        single: async () => {
                                            const index = store.users.findIndex(u => u[field] === value);
                                            if (index === -1) return { data: null, error: 'Not found' };
                                            store.users[index] = { ...store.users[index], ...data };
                                            return { data: store.users[index], error: null };
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
        }
    };
};

// Test Register
async function testRegister() {
    console.log('Testing /register...');
    const supabase = createMockSupabase();

    const event = {
        httpMethod: 'POST',
        path: '/api/auth/register',
        body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
            displayName: 'Test User',
            hearthKey: 'HEARTH-TEST-KEY-12', // 16 chars + dashes
            privacySettings: { discoverable: true }
        })
    };

    const response = await authLogic(event, supabase);

    if (response.statusCode !== 201) {
        console.error('Register failed:', response);
    }
    assert.strictEqual(response.statusCode, 201);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.user.email, 'test@example.com');
    // Key might be generated or provided. Here provided.
    assert.strictEqual(body.user.hearthKey, 'HEARTH-TEST-KEY-12');
    assert.strictEqual(body.user.privacySettings.discoverable, true);
    console.log('PASS: /register');
}

// Test Login (Implicitly tested via flow, but let's test isolation if needed.
// However, since we mock bcrypt in main code it's hard to test login without mocking bcrypt here or using real bcrypt.
// auth.js uses real bcrypt. So we can test login if we register first.)
async function testLogin() {
    console.log('Testing /login...');
    const supabase = createMockSupabase();

    // 1. Register first to populate store
    const regEvent = {
        httpMethod: 'POST',
        path: '/api/auth/register',
        body: JSON.stringify({
            email: 'login@example.com',
            password: 'password123',
            displayName: 'Login User'
        })
    };
    await authLogic(regEvent, supabase);

    // 2. Login
    const loginEvent = {
        httpMethod: 'POST',
        path: '/api/auth/login',
        body: JSON.stringify({
            email: 'login@example.com',
            password: 'password123'
        })
    };

    const response = await authLogic(loginEvent, supabase);
    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.user.email, 'login@example.com');
    assert.ok(body.token);
    console.log('PASS: /login');
    return body.token;
}

// Test Patch User (Future)
async function testPatchUser() {
    console.log('Testing PATCH /user...');
    const supabase = createMockSupabase();

    // 1. Register
    const regEvent = {
        httpMethod: 'POST',
        path: '/api/auth/register',
        body: JSON.stringify({
            email: 'patch@example.com',
            password: 'password123',
            displayName: 'Patch User'
        })
    };
    const regRes = await authLogic(regEvent, supabase);
    const token = JSON.parse(regRes.body).token;

    // 2. Patch
    const patchEvent = {
        httpMethod: 'PATCH',
        path: '/api/auth/user',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            displayName: 'Updated Name',
            privacySettings: { discoverable: true }
        })
    };

    const response = await authLogic(patchEvent, supabase);

    if (response.statusCode !== 200) {
        console.log('Response:', response);
    }
    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.user.displayName, 'Updated Name');
    assert.strictEqual(body.user.privacySettings.discoverable, true);
    console.log('PASS: PATCH /user');
}

async function runTests() {
    try {
        await testRegister();
        await testLogin();
        await testPatchUser();
    } catch (e) {
        console.error('Test Failed:', e);
        process.exit(1);
    }
}

runTests();
