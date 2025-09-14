import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

// ES module equivalent of __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// List your test cases (scene names)
const TEST_CASES = ['triangle', 'cubes', 'camera-controls'];

test('webgl test page loads', async ({ page }) => {
    await page.goto('https://get.webgl.org/');
    await page.waitForTimeout(1000);
    // await page.screenshot({ path: 'dbg-webgl.png', fullPage: true });

    await expect(page.getByText('Your browser supports WebGL')).toBeVisible();
});

test('webgpu report page loads', async ({ page }) => {
    await page.goto('https://webgpureport.org/');
    await page.waitForTimeout(1000);
    // await page.screenshot({ path: 'dbg-webgpu-report.png', fullPage: true });

    const title = await page.title();
    expect(title).toContain('WebGPU');
    await expect(page.getByText('WebGPU Report')).toBeVisible();
});

test('check GPU support', async ({ page }) => {
    await page.goto('chrome://gpu');
    await page.waitForTimeout(1000);
    // await page.screenshot({ path: 'dbg-chrome-gpu.png', fullPage: true });

    await expect(page.getByText('Canvas: Hardware accelerated')).toBeVisible();
    await expect(page.getByText('WebGPU: Hardware accelerated')).toBeVisible();
});

for (const testName of TEST_CASES) {
    test(`renders ${testName} scene and matches snapshot`, async ({ page }) => {
        // Go to your test page (now using relative path and baseURL from config)
        await page.goto('/test-renderer.html', { waitUntil: 'networkidle' });

        // Wait for page to be done-done
        await page.waitForTimeout(1000);
        // await page.screenshot({ path: `dbg-output-${testName}-full.png`, fullPage: true });
        // Listen for all console logs
        // page.on('console', msg => console.log('DBG:', msg.text()));
        // await page.evaluate(() => { console.log('Page loaded and ready'); });

        // Set up the scene for this test
        await page.evaluate((name) => {
            // @ts-ignore
            window.runRenderingTest(name);
        }, testName);

        // Wait for rendering to finish (customize as needed)
        await page.waitForTimeout(500);

        // await page.screenshot({ path: `dbg-output-${testName}-full.png`, fullPage: true });

        // Get canvas image data
        const outputPath = path.join(__dirname, `output-${testName}.png`);
        const buffer = await page.locator('#test-canvas').screenshot({ path: outputPath });

        // Check for empty/transparent output
        const img = PNG.sync.read(buffer);
        let nonBgPixelCount = 0;
        // Assume background is fully transparent (rgba = 0,0,0,0) or opaque bg color (e.g. #333)
        // For WebGPU, you may want to check for a specific clear color, e.g. (51, 51, 51, 255)
        for (let i = 0; i < img.data.length; i += 4) {
            const b = img.data[i];
            const g = img.data[i + 1];
            const r = img.data[i + 2];
            const a = img.data[i + 3]; // bgra!!!
            // Count non-transparent and non-background pixels
            if (!(r === 26 && g === 26 && b === 51 && a === 255) && a !== 0) {
                nonBgPixelCount++;
            }
        }
        expect(nonBgPixelCount).toBeGreaterThan(0);

        // Compare with snapshot
        const snapshotPath = path.join(__dirname, '..', 'snapshots', `${testName}.png`);
        if (fs.existsSync(snapshotPath)) {
            const img1 = img;
            const img2 = PNG.sync.read(fs.readFileSync(snapshotPath));
            const diff = new PNG({ width: img1.width, height: img1.height });
            const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, img1.width, img1.height, { threshold: 0.1 });

            expect(numDiffPixels).toBeLessThan(10);
        } else {
            // If no snapshot exists, save the first output as the snapshot
            fs.writeFileSync(snapshotPath, buffer);
            expect(true).toBe(true);
        }
    });
}
