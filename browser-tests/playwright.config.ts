import { defineConfig } from '@playwright/test';
import { existsSync } from 'fs';

// Cloud sessions ship a preinstalled Chromium at a fixed path that may not match
// the version @playwright/test expects; the /opt/pw-browsers/chromium symlink
// always points at the browser build that's actually present.
const cloudChromiumPath = '/opt/pw-browsers/chromium';
const executablePath = existsSync(cloudChromiumPath) ? cloudChromiumPath : undefined;

export default defineConfig({
    use: {
        headless: false,
        ignoreHTTPSErrors: true,
        baseURL: 'https://localhost:5173',
        screenshot: 'only-on-failure',
        launchOptions: executablePath ? { executablePath } : undefined,
    },
});
