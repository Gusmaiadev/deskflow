import type { TicketFilters, TicketSort } from '@/api/tickets';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '@/lib/labels';
import type { TicketPriority, TicketStatus } from '@/types/api';

// Os filtros moram na URL (?status=OPEN&page=2). Assim, o F5 mantém a tela como estava,
// o botão Voltar do navegador funciona e um link copiado abre a mesma lista.

export const PAGE_SIZE = 10;

export const SORT_OPTIONS: { value: TicketSort; label: string }[] = [
  { value: 'newest', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'due', label: 'Prazo mais próximo' },
  { value: 'priority', label: 'Maior prioridade' },
];

const STATUSES = STATUS_OPTIONS.map((option) => option.value);
const PRIORITIES = PRIORITY_OPTIONS.map((option) => option.value);
const SORTS = SORT_OPTIONS.map((option) => option.value);

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((item) => item === value);
}

/** Lê os filtros da URL, ignorando valores inválidos (alguém pode editar a URL à mão). */
export function readFilters(params: URLSearchParams): TicketFilters {
  const page = Number(params.get('page'));

  return {
    q: params.get('q') || undefined,
    status: pick<TicketStatus>(params.get('status'), STATUSES),
    priority: pick<TicketPriority>(params.get('priority'), PRIORITIES),
    categoryId: params.get('categoryId') || undefined,
    assignee: params.get('assignee') || undefined,
    overdue: params.get('overdue') === 'true' ? true : undefined,
    sort: pick<TicketSort>(params.get('sort'), SORTS) ?? 'newest',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: PAGE_SIZE,
  };
}

/** Quantos filtros estão ativos (a ordenação e a página não contam). */
export function countActiveFilters(filters: TicketFilters): number {
  const { q, status, priority, categoryId, assignee, overdue } = filters;
  return [q, status, priority, categoryId, assignee, overdue].filter((value) => value !== undefined).length;
}
