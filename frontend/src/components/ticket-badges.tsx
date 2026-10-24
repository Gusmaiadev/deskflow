import { Badge } from '@/components/ui/badge';
import { PRIORITY_LABELS, STATUS_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type { TicketPriority, TicketStatus } from '@/types/api';

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: 'border-sky-200 bg-sky-50 text-sky-800',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-800',
  WAITING_REQUESTER: 'border-violet-200 bg-violet-50 text-violet-800',
  RESOLVED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  CLOSED: 'border-zinc-200 bg-zinc-100 text-zinc-600',
};

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  LOW: 'border-zinc-200 bg-zinc-50 text-zinc-700',
  MEDIUM: 'border-blue-200 bg-blue-50 text-blue-800',
  HIGH: 'border-orange-200 bg-orange-50 text-orange-800',
  URGENT: 'border-red-200 bg-red-50 text-red-800',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge variant="outline" className={cn('font-medium', PRIORITY_STYLES[priority])}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function OverdueBadge() {
  return <Badge variant="destructive">Atrasado</Badge>;
}
