import { defineConfig } from 'vitest/config';
import { loadTestEnv } from './tests/setup/test-env.js';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: loadTestEnv(),
    globalSetup: ['./tests/setup/global-setup.ts'],
    // Os arquivos de teste dividem o mesmo banco: rodam um de cada vez.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      // Todo o código da API, inclusive o que nenhum teste carrega (senão ele nem apareceria no relatório).
      include: ['src/**/*.ts'],
      // Código gerado pelo Prisma e o ponto de entrada, que só sobe o servidor.
      exclude: ['src/generated/**', 'src/server.ts'],
    },
  },
});
