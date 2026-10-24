import type { Role, TicketPriority, TicketStatus } from '@/types/api';

// A API fala em códigos (OPEN, URGENT...); a tela fala português.
// Os arrays definem também a ordem em que as opções aparecem nos filtros.

export const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'OPEN', label: 'Aberto' },
  { value: 'IN_PROGRESS', label: 'Em andamento' },
  { value: 'WAITING_REQUESTER', label: 'Aguardando solicitante' },
  { value: 'RESOLVED', label: 'Resolvido' },
  { value: 'CLOSED', label: 'Fechado' },
];

export const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'LOW', label: 'Baixa' },
  { value: 'MEDIUM', label: 'Média' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrador',
  AGENT: 'Técnico',
  REQUESTER: 'Solicitante',
};

export const STATUS_LABELS = Object.fromEntries(
  STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<TicketStatus, string>;

export const PRIORITY_LABELS = Object.fromEntries(
  PRIORITY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<TicketPriority, string>;
