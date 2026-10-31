import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TicketDetail } from '@/types/api';
import { EditTicketDialog } from './edit-ticket-dialog';

// O diálogo só conversa com a API pelo useUpdateTicket: o teste troca a gravação por um mock.
const { mutateAsync, toast } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/api/tickets', () => ({ useUpdateTicket: () => ({ mutateAsync }) }));
vi.mock('sonner', () => ({ toast }));

const ticket = {
  id: 'ticket-1',
  number: 42,
  title: 'Impressora sem conexão',
  description: 'A impressora do 3º andar não aparece na rede.',
  status: 'OPEN',
} as TicketDetail;

function apiError(code: string, message: string) {
  const response = { status: 409, data: { error: { code, message } } } as AxiosResponse;
  return new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, response);
}

async function openDialog() {
  const user = userEvent.setup();
  render(<EditTicketDialog ticket={ticket} />);
  await user.click(screen.getByRole('button', { name: 'Editar' }));
  return user;
}

const titleInput = () => screen.getByLabelText('Título');
const saveButton = () => screen.getByRole('button', { name: 'Salvar' });

describe('EditTicketDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('abre com o título e a descrição atuais e, sem mudanças, fecha sem gravar', async () => {
    const user = await openDialog();

    expect(titleInput()).toHaveValue(ticket.title);
    expect(screen.getByLabelText('Descrição')).toHaveValue(ticket.description);

    await user.click(saveButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('valida com as regras da API antes de enviar', async () => {
    const user = await openDialog();

    await user.clear(titleInput());
    await user.type(titleInput(), 'Ops');
    await user.click(saveButton());

    expect(await screen.findByText('O título precisa ter pelo menos 5 caracteres.')).toBeInTheDocument();
    expect(titleInput()).toHaveAttribute('aria-invalid', 'true');
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('grava o texto sem os espaços das pontas, avisa e fecha', async () => {
    mutateAsync.mockResolvedValue({ ...ticket, title: 'Impressora do 3º andar sem conexão' });
    const user = await openDialog();

    await user.clear(titleInput());
    await user.type(titleInput(), '  Impressora do 3º andar sem conexão  ');
    await user.click(saveButton());

    expect(mutateAsync).toHaveBeenCalledExactlyOnceWith({
      title: 'Impressora do 3º andar sem conexão',
      description: ticket.description,
    });
    expect(toast.success).toHaveBeenCalledWith('Chamado atualizado.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('quando o atendimento já começou, avisa no toast e fecha', async () => {
    const message = 'Título e descrição só podem ser editados enquanto o chamado está aberto.';
    mutateAsync.mockRejectedValue(apiError('TICKET_NOT_EDITABLE', message));
    const user = await openDialog();

    await user.type(titleInput(), ' (urgente)');
    await user.click(saveButton());

    expect(toast.error).toHaveBeenCalledWith(message);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('em outro erro, mostra a mensagem e mantém o texto digitado', async () => {
    const message = 'O chamado foi alterado por outra pessoa. Recarregue e tente de novo.';
    mutateAsync.mockRejectedValue(apiError('TICKET_CHANGED', message));
    const user = await openDialog();

    await user.type(titleInput(), ' (urgente)');
    await user.click(saveButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(titleInput()).toHaveValue(`${ticket.title} (urgente)`);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
