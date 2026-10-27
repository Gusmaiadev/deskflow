import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/**
 * Variáveis de ambiente dos testes: as mesmas do .env, mas com DATABASE_URL
 * apontando para o banco de TESTES. Os testes apagam dados, então nunca
 * podem rodar no banco de desenvolvimento.
 */
export function loadTestEnv(): Record<string, string | undefined> {
  const fromFile = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {};

  const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? fromFile.TEST_DATABASE_URL;
  const devDatabaseUrl = process.env.DATABASE_URL ?? fromFile.DATABASE_URL;

  if (!testDatabaseUrl) {
    throw new Error('Defina TEST_DATABASE_URL no .env para rodar os testes.');
  }

  if (testDatabaseUrl === devDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL precisa ser diferente de DATABASE_URL: os testes apagam todos os dados.');
  }

  return {
    ...fromFile,
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl,
    // Listas fixas nos testes, escritas "sujas" (maiúsculas e espaços) para provar a normalização.
    DEMO_ACCOUNT_EMAILS: 'Demo@Test.example, outra.demo@test.example',
    DEMO_CATEGORY_NAMES: ' categoria demo , Outra Demo',
  };
}
