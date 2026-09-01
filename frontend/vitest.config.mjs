import { defineConfig } from 'vitest/config';
import { transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Vite 8's oxc parser refuses JSX in plain .js files, but every page in this
// app is a .js file containing JSX (Next.js itself is fine with that).
// Re-parse project .js files as JSX so component tests can import pages.
const jsxInJs = () => ({
  name: 'jsx-in-js',
  enforce: 'pre',
  async transform(code, id) {
    const normalized = id.replace(/\\/g, '/');
    if (normalized.includes('/node_modules/')) return null;
    if (!/\.js(\?.*)?$/.test(normalized)) return null;
    return transformWithOxc(code, id, { lang: 'jsx' });
  },
});

export default defineConfig({
  plugins: [jsxInJs(), react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      include: ['src/lib/**', 'src/hooks/**'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/test/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
