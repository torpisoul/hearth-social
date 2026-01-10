import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['js/*.js'],
      exclude: ['js/qrcode.min.js', 'js/theme-init.js', 'js/notice-board.js', 'js/landing.js', 'js/login.js', 'js/onboarding.js'],
      reporter: ['text', 'json', 'html'],
      all: true
    }
  }
});
