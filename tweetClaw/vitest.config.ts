import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node', // We don't need full DOM for background scripts
        globals: true,
    },
});
