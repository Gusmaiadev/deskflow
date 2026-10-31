import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@/types/api';
import { CategoryDialog } from './category-dialog';

// O diálogo só conversa com a API pelos hooks de categorias: o teste troca a gravação por mocks.
const { createAsync, updateAsync, toast } = vi.hoisted(() => ({
  createAsync: vi.fn(),
  updateAsync: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/api/categories', () => ({
  useCreateCategory: () => ({ mutateAsync: createAsync }),
  useUpdateCategory: () => ({ mutateAsync: updateAsync }),
}));
vi.mock('sonner', () => ({ toast }));

const hardware: Category = {
  id: 'category-1',
  name: 'Hardware',
  description: 'Computadores, impressoras e periféricos.',
  isActive: true,
};

function apiError(status: number, code: string, message: string) {
  const response = { status, data: { error: { code, message } } } as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, response);
}

async function openDialog(category?: Category) {
  const user = userEvent.setup();
  render(<CategoryDialog category={category} />);
  await user.click(screen.getByRole('button', { name: category ? `Editar ${category.name}` : 'Nova categoria' }));
  return user;
}

const nameInput = () => screen.getByLabelText('Nome');
const descriptionInput = () => screen.getByLabelText('Descrição (opcional)');

describe('CategoryDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cadastra sem descrição quando o campo fica vazio', async () => {
    createAsync.mockResolvedValue({ ...hardware, id: 'category-2', name: 'Telefonia', description: null });
    const user = await openDialog();

    await user.type(nameInput(), '  Telefonia ');
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(createAsync).toHaveBeenCalledExactlyOnceWith({ name: 'Telefonia', description: undefined });
    expect(toast.success).toHaveBeenCalledWith('Categoria Telefonia cadastrada.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('valida o nome com as regras da API antes de enviar', async () => {
    const user = await openDialog();

    await user.type(nameInput(), 'T');
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(await screen.findByText('O nome precisa ter pelo menos 2 caracteres.')).toBeInTheDocument();
    expect(createAsync).not.toHaveBeenCalled();
  });

  it('nome repetido: a mensagem da API aparece no campo do nome', async () => {
    const message = 'Já existe uma categoria com este nome.';
    createAsync.mockRejectedValue(apiError(409, 'CATEGORY_NAME_IN_USE', message));
    const user = await openDialog();

    await user.type(nameInput(), 'Hardware');
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('edita a partir dos valores atuais, e apagar a descrição envia null', async () => {
    updateAsync.mockResolvedValue({ ...hardware, description: null });
    const user = await openDialog(hardware);

    expect(nameInput()).toHaveValue(hardware.name);
    await user.clear(descriptionInput());
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(updateAsync).toHaveBeenCalledExactlyOnceWith({
      id: hardware.id,
      changes: { name: 'Hardware', description: null },
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sem mudanças, fecha sem gravar', async () => {
    const user = await openDialog(hardware);

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(updateAsync).not.toHaveBeenCalled();
  });

  it('categoria da demonstração: mostra a recusa da API no formulário', async () => {
    const message = 'As categorias da demonstração não podem ser alteradas.';
    updateAsync.mockRejectedValue(apiError(403, 'DEMO_CATEGORY', message));
    const user = await openDialog(hardware);

    await user.type(nameInput(), ' e periféricos');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
