# Browser-Based Rendering Tests

This folder contains Playwright-powered browser rendering tests for the WebGPU renderer. Tests run in a real browser, capture canvas output, and compare it to reference snapshots using pixelmatch.

## Flow Overview

1. **Vite Server**: Start your Vite dev server (HTTPS, self-signed cert OK) with `npm run dev` in the project root.
2. **Test Page**: The test page (`/v2/test-renderer.html`) exposes a global `window.runRenderingTest(testName)` function to set up scenes.
3. **Playwright Test**: Playwright launches a browser, navigates to the test page, triggers rendering, captures the canvas as PNG, and compares it to the snapshot.
4. **Pixelmatch**: If the output differs from the snapshot, the test fails and a diff is available for inspection.

## Installation

```sh
cd browser-tests
npm install
```

## Running Tests

Make sure your Vite server is running at `https://localhost:5173/`.

```sh
npm test
```

## Adding New Tests

1. **Add a new test case name** to the `TEST_CASES` array in `webgpu.renderer.playwright.test.ts`.
2. **Update `window.runRenderingTest`** in `src/v2/test-renderer.ts` to handle the new test case and set up the scene.
3. **Run the tests**. The first run will create a snapshot PNG in `snapshots/` if it doesn't exist.

## Handling Snapshot Failures

- **If a test fails** (pixelmatch reports too many differing pixels):
  - Inspect the output PNG in this folder and the corresponding snapshot in `snapshots/`.
  - **Assume it is a regression** unless you have intentionally changed the rendering output (e.g., bug fix, feature, or improvement).
  - If the change is intentional and correct, **replace the snapshot** with the new output:
    ```sh
    cp output-<testName>.png snapshots/<testName>.png
    ```
  - Commit the updated snapshot with a clear message explaining the change.

**Always review visual changes carefully.** Accept new snapshots only for intentional improvements or fixes, not for unexpected regressions.

## Notes

- Tests run in Chromium by default. You can configure Playwright to run in Firefox or WebKit for cross-browser coverage.
- Self-signed HTTPS is supported (see `playwright.config.ts`).
- All test logic and snapshots are local to this folder and do not affect your main project dependencies.
