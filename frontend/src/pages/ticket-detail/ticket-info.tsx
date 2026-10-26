import type { ReactNode } from 'react';
import { OverdueBadge } from '@/components/ticket-badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { TicketDetail } from '@/types/api';

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function TicketInfo({ ticket }: { ticket: TicketDetail }) {
  const finished = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhes</CardTitle>
      </CardHeader>
      <CardContent>
        {/* dl/dt/dd: a lista de "termo e definição" do HTML, a certa para pares rótulo-valor */}
        <dl className="flex flex-col gap-3">
          <Item label="Solicitante">{ticket.requester.name}</Item>
          <Item label="Responsável">
            {ticket.assignee?.name ?? <span className="text-muted-foreground">Ninguém ainda</span>}
          </Item>
          <Item label="Categoria">{ticket.category.name}</Item>
          <Item label="Aberto em">{formatDateTime(ticket.createdAt)}</Item>
          <Item label="Prazo (SLA)">
            {ticket.waitingSince ? (
              // Aguardando o solicitante: o relógio para, e o prazo anda o tempo parado quando a espera termina.
              <span className="flex flex-wrap items-center gap-2">
                <span>
                  Pausado desde {formatDateTime(ticket.waitingSince)}
                  <span className="text-muted-foreground"> (aguardando o solicitante)</span>
                </span>
                {ticket.isOverdue && <OverdueBadge />}
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                {formatDateTime(ticket.dueAt)}
                {!finished && <span className="text-muted-foreground">({formatRelative(ticket.dueAt)})</span>}
                {ticket.isOverdue && <OverdueBadge />}
              </span>
            )}
          </Item>
          {ticket.resolvedAt && <Item label="Resolvido em">{formatDateTime(ticket.resolvedAt)}</Item>}
          {ticket.closedAt && <Item label="Fechado em">{formatDateTime(ticket.closedAt)}</Item>}
        </dl>
      </CardContent>
    </Card>
  );
}
