const baseURL = process.env.UI_SCREENSHOT_BASE_URL || 'http://127.0.0.1:3000';

const config = {
  testDir: './tests',
  outputDir: '.artifacts/playwright-test-results',
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { viewport: { width: 1440, height: 1100 } },
    },
    {
      name: 'chromium-mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
};

export default config;
