import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    restoreMocks: true,
    // Tests are added incrementally; keep CI green while the suite is small.
    passWithNoTests: true,
  },
});
