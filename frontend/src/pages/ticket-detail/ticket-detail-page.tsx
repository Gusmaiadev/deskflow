import { ArrowLeft, SearchX } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { useTicket } from '@/api/tickets';
import { useAuth } from '@/auth/auth-context';
import { EmptyState, ErrorState } from '@/components/feedback';
import { OverdueBadge, PriorityBadge, StatusBadge } from '@/components/ticket-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { useDocumentTitle } from '@/lib/use-document-title';
import { CommentsSection } from './comments-section';
import { TicketActions } from './ticket-actions';
import { TicketInfo } from './ticket-info';

function BackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
      <Link to="/tickets">
        <ArrowLeft aria-hidden="true" />
        Chamados
      </Link>
    </Button>
  );
}

function TicketDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Carregando chamado">
      <Skeleton className="h-8 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const ticket = useTicket(id);
  const isStaff = user?.role === 'AGENT' || user?.role === 'ADMIN';

  useDocumentTitle(ticket.data ? `#${ticket.data.number} ${ticket.data.title}` : 'Chamado');

  if (ticket.isPending) return <TicketDetailSkeleton />;

  if (ticket.isError) {
    // Id inexistente, de outra pessoa (a API responde 404, e não 403) ou mal formado.
    const code = getErrorCode(ticket.error);
    if (code === 'TICKET_NOT_FOUND' || code === 'VALIDATION_ERROR') {
      return (
        <div className="flex flex-col gap-4">
          <BackLink />
          <EmptyState
            icon={SearchX}
            title="Chamado não encontrado"
            description="Ele não existe, ou você não tem acesso a ele."
          />
        </div>
      );
    }
    return <ErrorState message={getErrorMessage(ticket.error)} onRetry={() => void ticket.refetch()} />;
  }

  const data = ticket.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <BackLink />
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={data.status} />
          <PriorityBadge priority={data.priority} />
          {data.isOverdue && <OverdueBadge />}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="text-muted-foreground">#{data.number}</span> {data.title}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm break-words whitespace-pre-wrap">{data.description}</p>
            </CardContent>
          </Card>
          {/* key: ao ir de um chamado para outro, o formulário de comentário começa vazio */}
          <CommentsSection key={data.id} ticket={data} isStaff={isStaff} />
        </div>

        <div className="flex flex-col gap-6">
          <TicketActions ticket={data} isStaff={isStaff} />
          <TicketInfo ticket={data} />
        </div>
      </div>
    </div>
  );
}
