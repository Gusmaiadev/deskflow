import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TicketDetail, TicketStatus } from '@/types/api';
import { TicketActions } from './ticket-actions';

// O componente só conversa com a API pelos hooks: o teste troca a gravação por um mock.
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('@/api/tickets', () => ({ useUpdateTicket: () => ({ mutate, isPending: false }) }));
vi.mock('@/api/users', () => ({ useStaff: () => ({ data: [] }) }));

// O que a API mandaria em allowedStatuses (ticket-rules.ts, no backend). A tela não sabe a regra:
// só mostra o que recebe. Por isso o teste passa a lista pronta, em vez de a tela calcular.
const STAFF: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['OPEN', 'WAITING_REQUESTER', 'RESOLVED'],
  WAITING_REQUESTER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
};

const REQUESTER: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['CLOSED'],
  IN_PROGRESS: [],
  WAITING_REQUESTER: [],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  CLOSED: [],
};

function makeTicket(status: TicketStatus, isStaff: boolean): TicketDetail {
  return {
    id: 'ticket-1',
    number: 7,
    status,
    priority: 'MEDIUM',
    assignee: null,
    allowedStatuses: (isStaff ? STAFF : REQUESTER)[status],
  } as TicketDetail;
}

function renderActions(status: TicketStatus, isStaff: boolean) {
  const user = userEvent.setup();
  render(<TicketActions ticket={makeTicket(status, isStaff)} isStaff={isStaff} />);
  return user;
}

/** Os botões de ação, na ordem da tela, e qual deles é o destaque. */
function actionButtons() {
  const buttons = screen.queryAllByRole('button');
  return {
    labels: buttons.map((button) => button.textContent),
    primary: buttons.filter((button) => button.dataset.variant === 'default').map((button) => button.textContent),
  };
}

describe('TicketActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('equipe de suporte', () => {
    it.each<[TicketStatus, string[], string]>([
      ['OPEN', ['Assumir chamado', 'Marcar como resolvido', 'Fechar chamado'], 'Assumir chamado'],
      [
        'IN_PROGRESS',
        ['Marcar como resolvido', 'Pedir informação ao solicitante', 'Devolver para a fila'],
        'Marcar como resolvido',
      ],
      ['WAITING_REQUESTER', ['Retomar atendimento', 'Marcar como resolvido'], 'Retomar atendimento'],
      ['RESOLVED', ['Retomar atendimento', 'Fechar chamado'], 'Retomar atendimento'],
    ])('em %s, mostra %j com o primeiro em destaque', (status, labels, primary) => {
      renderActions(status, true);

      expect(actionButtons()).toEqual({ labels, primary: [primary] });
      expect(screen.getByLabelText('Prioridade')).toBeInTheDocument();
      expect(screen.getByLabelText('Responsável')).toBeInTheDocument();
    });

    it('em CLOSED, só avisa que o chamado não muda mais, sem botões nem seletores', () => {
      renderActions('CLOSED', true);

      expect(screen.getByText('Chamado fechado. Ele não pode mais ser alterado.')).toBeInTheDocument();
      expect(screen.queryAllByRole('button')).toHaveLength(0);
      expect(screen.queryByLabelText('Prioridade')).not.toBeInTheDocument();
    });
  });

  describe('solicitante', () => {
    it.each<[TicketStatus, string[], string[], string | null]>([
      ['OPEN', ['Cancelar chamado'], ['Cancelar chamado'], null],
      ['IN_PROGRESS', [], [], 'Um técnico está cuidando do seu chamado.'],
      ['WAITING_REQUESTER', [], [], 'O técnico aguarda a sua resposta nos comentários.'],
      [
        'RESOLVED',
        ['O problema continua', 'Confirmar solução'],
        ['Confirmar solução'],
        'O técnico marcou como resolvido. Confirme ou avise que continua.',
      ],
      ['CLOSED', [], [], 'Chamado fechado. Ele não pode mais ser alterado.'],
    ])('em %s, mostra %j', (status, labels, primary, hint) => {
      renderActions(status, false);

      expect(actionButtons()).toEqual({ labels, primary });
      if (hint) expect(screen.getByText(hint)).toBeInTheDocument();
      // Prioridade e responsável são da equipe: o solicitante nem vê os seletores.
      expect(screen.queryByLabelText('Prioridade')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Responsável')).not.toBeInTheDocument();
    });
  });

  it('um clique numa transição envia o novo status para a API', async () => {
    const user = renderActions('IN_PROGRESS', true);

    await user.click(screen.getByRole('button', { name: 'Pedir informação ao solicitante' }));

    expect(mutate).toHaveBeenCalledExactlyOnceWith({ status: 'WAITING_REQUESTER' }, expect.any(Object));
  });

  it('fechar pede confirmação antes de chamar a API', async () => {
    const user = renderActions('RESOLVED', false);

    await user.click(screen.getByRole('button', { name: 'Confirmar solução' }));
    expect(mutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole('alertdialog', { name: 'Fechar o chamado #7?' });
    await user.click(within(dialog).getByRole('button', { name: 'Fechar chamado' }));

    expect(mutate).toHaveBeenCalledExactlyOnceWith({ status: 'CLOSED' }, expect.any(Object));
  });
});
