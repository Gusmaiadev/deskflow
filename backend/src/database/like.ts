/**
 * O Prisma traduz `contains` (e `equals` com `mode: 'insensitive'`) para LIKE/ILIKE, em que % e _
 * são curingas e \ é o caractere de escape. Escapados, eles passam a valer como texto comum.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}
