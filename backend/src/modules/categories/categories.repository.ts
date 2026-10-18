import { prisma } from '../../database/prisma.js';

/** Os campos que a API expõe de uma categoria. O "select" já entrega o DTO pronto. */
const categorySelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
} as const;

export function list(filters: { onlyActive: boolean }) {
  return prisma.category.findMany({
    where: filters.onlyActive ? { isActive: true } : {},
    select: categorySelect,
    orderBy: { name: 'asc' },
  });
}

export function findById(id: string) {
  return prisma.category.findUnique({ where: { id }, select: categorySelect });
}

/** Busca ignorando maiúsculas e minúsculas: "hardware" e "Hardware" são a mesma categoria. */
export function findByName(name: string) {
  return prisma.category.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: categorySelect,
  });
}

export function create(data: { name: string; description?: string }) {
  return prisma.category.create({ data, select: categorySelect });
}

export function update(id: string, data: { name?: string; description?: string | null; isActive?: boolean }) {
  return prisma.category.update({ where: { id }, data, select: categorySelect });
}
