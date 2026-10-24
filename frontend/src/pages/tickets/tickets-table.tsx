import { OverdueBadge, PriorityBadge, StatusBadge } from '@/components/ticket-badges';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { Ticket } from '@/types/api';

function DueCell({ ticket }: { ticket: Ticket }) {
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    return <span className="text-muted-foreground">Concluído</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {ticket.waitingSince ? (
        // Aguardando o solicitante: o relógio do SLA para, e o prazo só anda quando a espera termina.
        <span
          className="text-muted-foreground"
          title={`Aguardando o solicitante desde ${formatDateTime(ticket.waitingSince)}`}
        >
          SLA pausado
        </span>
      ) : (
        <span title={formatDateTime(ticket.dueAt)}>{formatRelative(ticket.dueAt)}</span>
      )}
      {ticket.isOverdue && <OverdueBadge />}
    </div>
  );
}

function TableHeadRow() {
  return (
    <TableRow>
      <TableHead className="w-16">Nº</TableHead>
      <TableHead>Chamado</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="hidden sm:table-cell">Prioridade</TableHead>
      <TableHead className="hidden lg:table-cell">Responsável</TableHead>
      <TableHead className="hidden md:table-cell">Prazo</TableHead>
    </TableRow>
  );
}

export function TicketsTable({ tickets }: { tickets: Ticket[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableHeadRow />
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow key={ticket.id}>
              <TableCell className="font-mono text-muted-foreground">#{ticket.number}</TableCell>
              <TableCell className="max-w-72 whitespace-normal">
                <p className="line-clamp-2 font-medium">{ticket.title}</p>
                <p className="text-xs text-muted-foreground">
                  {ticket.category.name} · aberto {formatRelative(ticket.createdAt)} por {ticket.requester.name}
                </p>
              </TableCell>
              <TableCell>
                <StatusBadge status={ticket.status} />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <PriorityBadge priority={ticket.priority} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {ticket.assignee?.name ?? <span className="text-muted-foreground">Ninguém ainda</span>}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <DueCell ticket={ticket} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** A "silhueta" da tabela enquanto os dados chegam. */
export function TicketsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-lg border" role="status" aria-label="Carregando chamados">
      <Table>
        <TableHeader>
          <TableHeadRow />
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, index) => (
            <TableRow key={index}>
              <TableCell>
                <Skeleton className="h-4 w-8" />
              </TableCell>
              <TableCell>
                <Skeleton className="mb-2 h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20" />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <Skeleton className="h-4 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
