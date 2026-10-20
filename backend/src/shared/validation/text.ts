/**
 * O PostgreSQL não aceita o caractere nulo (U+0000) em textos. Sem esta regra, um texto com ele
 * passaria na validação e o banco recusaria a gravação (ou a busca) com um erro 500.
 */
export function hasNoNullCharacter(value: string): boolean {
  return !value.includes('\u0000');
}

export const NULL_CHARACTER_MESSAGE = 'O texto contém um caractere inválido.';
