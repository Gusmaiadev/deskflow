import { execSync } from 'node:child_process';
import { loadTestEnv } from './test-env.js';

/** Roda uma única vez, antes de todos os testes: aplica as migrations no banco de testes. */
export default function setup(): void {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, ...loadTestEnv() },
  });
}
