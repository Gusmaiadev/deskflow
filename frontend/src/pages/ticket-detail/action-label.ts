import type { TicketDetail, TicketStatus } from '@/types/api';

/** O texto do botão depende de onde o chamado está, para onde vai e de quem clica. */
export function actionLabel(
  ticket: Pick<TicketDetail, 'status' | 'assignee'>,
  to: TicketStatus,
  isStaff: boolean,
): string {
  if (!isStaff) {
    if (to === 'CLOSED') return ticket.status === 'RESOLVED' ? 'Confirmar solução' : 'Cancelar chamado';
    return 'O problema continua';
  }

  switch (to) {
    case 'IN_PROGRESS':
      if (ticket.status === 'OPEN') return ticket.assignee ? 'Iniciar atendimento' : 'Assumir chamado';
      return 'Retomar atendimento';
    case 'WAITING_REQUESTER':
      return 'Pedir informação ao solicitante';
    case 'RESOLVED':
      return 'Marcar como resolvido';
    case 'CLOSED':
      return 'Fechar chamado';
    case 'OPEN':
      return 'Devolver para a fila';
  }
}
