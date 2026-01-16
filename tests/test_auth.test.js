
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { authLogic } = require('../netlify/functions/auth.cjs');
import { describe, it, expect } from 'vitest';

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
                            // If update is called without select() immediately (which it is in reset-password)
                            const promise = (async () => {
                                const index = store.users.findIndex(u => u[field] === value);
                                if (index === -1) return { error: 'Not found' };
                                store.users[index] = { ...store.users[index], ...data };
                                return { data: store.users[index], error: null };
                            })();

                            // It also needs to handle .select().single() pattern if used
                            promise.select = () => ({
                                single: async () => {
                                     const index = store.users.findIndex(u => u[field] === value);
                                    if (index === -1) return { data: null, error: 'Not found' };
                                    store.users[index] = { ...store.users[index], ...data };
                                    return { data: store.users[index], error: null };
                                }
                            });

                            return promise;
                        }
                    }
                }
            };
        },
        storage: {
            from: (bucket) => {
                if (bucket !== 'parlor-media') throw new Error(`Unknown bucket ${bucket}`);
                return {
                    upload: async (path, buffer, options) => {
                        return { data: { path }, error: null };
                    },
                    getPublicUrl: (path) => {
                        return { data: { publicUrl: `https://example.com/${bucket}/${path}` } };
                    }
                };
            }
        }
    };
};

describe('Auth Logic', () => {

    it('should register a new user', async () => {
        const supabase = createMockSupabase();
        const event = {
            httpMethod: 'POST',
            path: '/api/auth/register',
            body: JSON.stringify({
                email: 'test@example.com',
                password: 'password123',
                displayName: 'Test User'
            })
        };

        const response = await authLogic(event, supabase);
        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.user.email).toBe('test@example.com');
    });

    it('should login a user', async () => {
        const supabase = createMockSupabase();
        // Register first
        await authLogic({
            httpMethod: 'POST',
            path: '/api/auth/register',
            body: JSON.stringify({
                email: 'login@example.com',
                password: 'password123',
                displayName: 'Login User'
            })
        }, supabase);

        const event = {
            httpMethod: 'POST',
            path: '/api/auth/login',
            body: JSON.stringify({
                email: 'login@example.com',
                password: 'password123'
            })
        };

        const response = await authLogic(event, supabase);
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.user.email).toBe('login@example.com');
        expect(body.token).toBeDefined();
    });

    it('should request a password reset', async () => {
        const supabase = createMockSupabase();

        // Register user first
        await authLogic({
            httpMethod: 'POST',
            path: '/api/auth/register',
            body: JSON.stringify({
                email: 'reset@example.com',
                password: 'password123',
                displayName: 'Reset User'
            }),
            headers: {}
        }, supabase);

        // Request reset
        const event = {
            httpMethod: 'POST',
            path: '/api/auth/reset-password-request',
            headers: { host: 'localhost:8888' },
            body: JSON.stringify({
                email: 'reset@example.com'
            })
        };

        const response = await authLogic(event, supabase);
        expect(response.statusCode).toBe(200);

        const body = JSON.parse(response.body);
        expect(body.message).toContain('reset link has been sent');
        expect(body.debugLink).toBeDefined();
        expect(body.debugLink).toContain('reset-password.html?token=');
    });

    it('should reset password with valid token', async () => {
        const supabase = createMockSupabase();

        // 1. Register
        await authLogic({
            httpMethod: 'POST',
            path: '/api/auth/register',
            body: JSON.stringify({
                email: 'reset2@example.com',
                password: 'oldpassword',
                displayName: 'Reset User 2'
            }),
            headers: {}
        }, supabase);

        // 2. Request Token
        const reqRes = await authLogic({
            httpMethod: 'POST',
            path: '/api/auth/reset-password-request',
            headers: { host: 'localhost:8888' },
            body: JSON.stringify({ email: 'reset2@example.com' })
        }, supabase);

        const token = JSON.parse(reqRes.body).debugLink.split('token=')[1];

        // 3. Reset Password
        const resetRes = await authLogic({
            httpMethod: 'POST',
            path: '/api/auth/reset-password',
            body: JSON.stringify({
                token: token,
                newPassword: 'newpassword123'
            })
        }, supabase);

        expect(resetRes.statusCode).toBe(200);

        // 4. Verify Login with New Password
        const loginRes = await authLogic({
            httpMethod: 'POST',
            path: '/api/auth/login',
            body: JSON.stringify({
                email: 'reset2@example.com',
                password: 'newpassword123'
            })
        }, supabase);

        expect(loginRes.statusCode).toBe(200);
    });

    it('should update user avatar', async () => {
        const supabase = createMockSupabase();

        // 1. Register User
        const registerRes = await authLogic({
            httpMethod: 'POST',
            path: '/api/auth/register',
            body: JSON.stringify({
                email: 'avatar@example.com',
                password: 'password123',
                displayName: 'Avatar User'
            })
        }, supabase);

        const { token, user } = JSON.parse(registerRes.body);

        // 2. Upload Avatar
        const updateRes = await authLogic({
            httpMethod: 'PATCH',
            path: '/api/auth/user',
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                avatarData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'
            })
        }, supabase);

        expect(updateRes.statusCode).toBe(200);
        const body = JSON.parse(updateRes.body);
        expect(body.user.avatarUrl).toBeDefined();
        expect(body.user.avatarUrl).toContain('https://example.com/parlor-media/avatars/');
    });
});
