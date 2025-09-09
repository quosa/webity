import { defineConfig } from '@playwright/test';

export default defineConfig({
    use: {
        headless: false,
        ignoreHTTPSErrors: true,
        baseURL: 'https://localhost:5173',
        screenshot: 'only-on-failure',
    },
});
