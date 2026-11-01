import { toast } from 'sonner';
import { useUpdateTicket, type TicketChanges } from '@/api/tickets';
import { useStaff } from '@/api/users';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { PRIORITY_OPTIONS } from '@/lib/labels';
import type { TicketDetail, TicketPriority, TicketStatus } from '@/types/api';
import { actionLabel } from './action-label';

const NO_ASSIGNEE = 'none';

// A ordem dos botões é decisão da tela (quais botões existem, quem decide é a API):
// o próximo passo mais comum primeiro, e fechar sempre por último.
const DISPLAY_ORDER: Record<TicketStatus, number> = {
  IN_PROGRESS: 0,
  RESOLVED: 1,
  WAITING_REQUESTER: 2,
  OPEN: 3,
  CLOSED: 4,
};

/** Uma frase sobre a situação, para quem não tem botão para apertar. */
function statusHint(ticket: TicketDetail, isStaff: boolean): string | null {
  if (ticket.status === 'CLOSED') return 'Chamado fechado. Ele não pode mais ser alterado.';
  if (isStaff) return null;
  if (ticket.status === 'WAITING_REQUESTER') return 'O técnico aguarda a sua resposta nos comentários.';
  if (ticket.status === 'IN_PROGRESS') return 'Um técnico está cuidando do seu chamado.';
  if (ticket.status === 'RESOLVED') return 'O técnico marcou como resolvido. Confirme ou avise que continua.';
  return null;
}

export function TicketActions({ ticket, isStaff }: { ticket: TicketDetail; isStaff: boolean }) {
  const update = useUpdateTicket(ticket.id);
  const staff = useStaff(isStaff);

  function apply(changes: TicketChanges, successMessage: (updated: TicketDetail) => string) {
    update.mutate(changes, {
      onSuccess: (updated) => {
        toast.success(successMessage(updated));
      },
      onError: (error) => {
        toast.error(getErrorMessage(error));
      },
    });
  }

  const changeStatus = (to: TicketStatus) =>
    apply({ status: to }, (updated) =>
      updated.waitingSince ? 'Status atualizado. O SLA fica pausado até o solicitante responder.' : 'Status atualizado.',
    );

  const hint = statusHint(ticket, isStaff);
  // O botão de fechar fica à parte e pede confirmação: fechar é definitivo.
  const transitions = ticket.allowedStatuses
    .filter((status) => status !== 'CLOSED')
    .sort((a, b) => DISPLAY_ORDER[a] - DISPLAY_ORDER[b]);
  const canClose = ticket.allowedStatuses.includes('CLOSED');
  // Fechar é o destaque quando é a única ação, ou quando o solicitante vê um chamado resolvido.
  const closeIsPrimary = canClose && (transitions.length === 0 || (!isStaff && ticket.status === 'RESOLVED'));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ações</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}

        {ticket.allowedStatuses.length > 0 && (
          <div className="flex flex-col gap-2">
            {transitions.map((status, index) => (
              <Button
                key={status}
                variant={index === 0 && !closeIsPrimary ? 'default' : 'outline'}
                disabled={update.isPending}
                onClick={() => changeStatus(status)}
              >
                {actionLabel(ticket, status, isStaff)}
              </Button>
            ))}

            {canClose && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant={closeIsPrimary ? 'default' : 'outline'} disabled={update.isPending}>
                    {actionLabel(ticket, 'CLOSED', isStaff)}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Fechar o chamado #{ticket.number}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Um chamado fechado não aceita mais comentários nem mudanças. Para um problema novo, abra outro
                      chamado.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction disabled={update.isPending} onClick={() => changeStatus('CLOSED')}>
                      Fechar chamado
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}

        {isStaff && ticket.status !== 'CLOSED' && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ticket-priority">Prioridade</Label>
              <Select
                value={ticket.priority}
                disabled={update.isPending}
                onValueChange={(priority) =>
                  apply({ priority: priority as TicketPriority }, (updated) =>
                    // Com o SLA pausado, o prazo gravado ainda não conta a espera em curso.
                    updated.waitingSince
                      ? 'Prioridade alterada. O prazo segue pausado até o solicitante responder.'
                      : `Prioridade alterada. Novo prazo: ${formatDateTime(updated.dueAt)}.`,
                  )
                }
              >
                <SelectTrigger id="ticket-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ticket-assignee">Responsável</Label>
              <Select
                value={ticket.assignee?.id ?? NO_ASSIGNEE}
                disabled={update.isPending}
                onValueChange={(value) =>
                  apply({ assigneeId: value === NO_ASSIGNEE ? null : value }, (updated) =>
                    updated.assignee ? `Responsável: ${updated.assignee.name}.` : 'Chamado sem responsável.',
                  )
                }
              >
                <SelectTrigger id="ticket-assignee" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ASSIGNEE}>Ninguém</SelectItem>
                  {(staff.data ?? []).map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
