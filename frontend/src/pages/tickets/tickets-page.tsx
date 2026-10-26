import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Inbox, SearchX } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useCategories } from '@/api/categories';
import { ticketsQueryOptions, useTickets } from '@/api/tickets';
import { useStaff } from '@/api/users';
import { useAuth } from '@/auth/auth-context';
import { EmptyState, ErrorState } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { useDocumentTitle } from '@/lib/use-document-title';
import { cn } from '@/lib/utils';
import { NewTicketDialog } from './new-ticket-dialog';
import { countActiveFilters, readFilters } from './ticket-filters';
import { TicketsTable, TicketsTableSkeleton } from './tickets-table';
import { TicketsToolbar, type FilterChanges } from './tickets-toolbar';

export function TicketsPage() {
  useDocumentTitle('Chamados');
  const { user } = useAuth();
  const isStaff = user?.role === 'AGENT' || user?.role === 'ADMIN';

  const [searchParams, setSearchParams] = useSearchParams();
  // O mesmo objeto enquanto a URL não muda: é dependência do pré-carregamento abaixo.
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const activeCount = countActiveFilters(filters);

  const queryClient = useQueryClient();
  const tickets = useTickets(filters);
  const categories = useCategories();
  const staff = useStaff(isStaff);

  // Assim que a página atual chega, a seguinte já é buscada em segundo plano:
  // o "Próxima" passa a abrir na hora, direto do cache. Durante o placeholder
  // (a página anterior ainda na tela), o total de páginas pode estar desatualizado.
  const totalPages = tickets.isPlaceholderData ? undefined : tickets.data?.meta.totalPages;
  useEffect(() => {
    if (totalPages === undefined || filters.page >= totalPages) return;
    void queryClient.prefetchQuery(ticketsQueryOptions({ ...filters, page: filters.page + 1 }));
  }, [queryClient, filters, totalPages]);

  /** Atualiza a URL. Mudar um filtro volta para a página 1; mudar de página, não. */
  const updateParams = useCallback(
    (changes: FilterChanges, options?: { replace?: boolean }) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined) next.delete(key);
          else next.set(key, value);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      }, options);
    },
    [setSearchParams],
  );

  const clearFilters = () => {
    // Mantém só a ordenação escolhida.
    setSearchParams(filters.sort === 'newest' ? {} : { sort: filters.sort });
  };

  const goToPage = (page: number) => updateParams({ page: String(page) });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chamados</h1>
          <p className="text-sm text-muted-foreground">
            {isStaff ? 'Todos os chamados da central de suporte.' : 'Os chamados que você abriu.'}
          </p>
        </div>
        <NewTicketDialog />
      </div>

      <TicketsToolbar
        filters={filters}
        activeCount={activeCount}
        isStaff={isStaff}
        categories={categories.data ?? []}
        staff={staff.data ?? []}
        onChange={updateParams}
        onClear={clearFilters}
      />

      {tickets.isPending ? (
        <TicketsTableSkeleton />
      ) : tickets.isError ? (
        <ErrorState message={getErrorMessage(tickets.error)} onRetry={() => void tickets.refetch()} />
      ) : tickets.data.data.length === 0 ? (
        activeCount > 0 || filters.page > 1 ? (
          <EmptyState
            icon={SearchX}
            title="Nenhum chamado com esses filtros"
            description="Tente outros filtros ou limpe a busca."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title="Nenhum chamado por aqui"
            description={isStaff ? 'Quando alguém abrir um chamado, ele aparece nesta lista.' : 'Você ainda não abriu nenhum chamado.'}
          />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {/* Enquanto a próxima página chega, a atual fica levemente apagada */}
          <div className={cn('transition-opacity', tickets.isPlaceholderData && 'opacity-60')}>
            <TicketsTable tickets={tickets.data.data} />
          </div>

          <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
            <span>
              {tickets.data.meta.total} {tickets.data.meta.total === 1 ? 'chamado' : 'chamados'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1 || tickets.isPlaceholderData}
                onClick={() => goToPage(filters.page - 1)}
              >
                <ChevronLeft aria-hidden="true" />
                Anterior
              </Button>
              <span aria-live="polite">
                Página {tickets.data.meta.page} de {Math.max(tickets.data.meta.totalPages, 1)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= tickets.data.meta.totalPages || tickets.isPlaceholderData}
                onClick={() => goToPage(filters.page + 1)}
              >
                Próxima
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
