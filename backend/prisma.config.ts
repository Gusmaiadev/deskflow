import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// O Prisma 7 não carrega o .env sozinho. Carregamos com o recurso nativo do Node,
// só se o arquivo existir (no build do Docker, por exemplo, ele não existe).
// Variáveis que já estão definidas no ambiente têm prioridade sobre o arquivo.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // env() falha com um erro claro se DATABASE_URL não estiver definida.
    url: env('DATABASE_URL'),
  },
});
