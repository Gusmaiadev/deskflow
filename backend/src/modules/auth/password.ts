import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';

/**
 * Argon2id com a configuração mínima recomendada pela OWASP:
 * 19 MiB de memória, 2 iterações e 1 thread.
 */
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

/** true quando o hash foi criado com parâmetros diferentes dos atuais e deve ser refeito. */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, HASH_OPTIONS);
}

let dummyHash: Promise<string> | undefined;

/**
 * Hash descartável, usado quando o e-mail do login não existe. Verificar a senha
 * contra ele faz a resposta demorar o mesmo tempo que um login com e-mail real.
 */
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}
