import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so tests don't load the PWA/React build plugins.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
