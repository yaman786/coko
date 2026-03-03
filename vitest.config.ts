import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',  // Pure logic tests, no DOM needed
        include: ['src/**/*.test.{ts,tsx}'],
    },
});
