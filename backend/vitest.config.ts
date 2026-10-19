import { defineConfig } from 'vitest/config';
import { loadTestEnv } from './tests/setup/test-env.js';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: loadTestEnv(),
    globalSetup: ['./tests/setup/global-setup.ts'],
    // Os arquivos de teste dividem o mesmo banco: rodam um de cada vez.
    fileParallelism: false,
  },
});
