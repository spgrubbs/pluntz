import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2020' },
  test: {
    testTimeout: 60000, // fixture worlds run thousands of sim ticks
  },
});
