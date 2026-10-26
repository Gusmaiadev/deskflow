import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '@/auth/auth-context';
import { LoginPage } from './login-page';

/** Mostra onde o login deixou a pessoa, para o teste conferir o redirecionamento. */
function CurrentLocation() {
  const location = useLocation();
  return <p>Você está em {`${location.pathname}${location.search}`}</p>;
}

function renderLoginPage({
  login = vi.fn<AuthContextValue['login']>().mockResolvedValue(undefined),
  from,
}: {
  login?: AuthContextValue['login'];
  from?: { pathname: string; search: string };
} = {}) {
  const auth: AuthContextValue = { status: 'anonymous', user: null, login, logout: vi.fn() };

  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from } : null }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<CurrentLocation />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

  return { login, user: userEvent.setup() };
}

const emailInput = () => screen.getByLabelText('E-mail');
const passwordInput = () => screen.getByLabelText('Senha');
const submitButton = () => screen.getByRole('button', { name: 'Entrar' });

describe('LoginPage', () => {
  it('enviado vazio, mostra a mensagem de cada campo e não chama a API', async () => {
    const { login, user } = renderLoginPage();

    await user.click(submitButton());

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument();
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput()).toHaveAccessibleDescription('Informe um e-mail válido.');
    expect(passwordInput()).toHaveAttribute('aria-invalid', 'true');
    expect(login).not.toHaveBeenCalled();
  });

  it('recusa um e-mail sem @', async () => {
    const { login, user } = renderLoginPage();

    await user.type(emailInput(), 'ana.deskflow.example');
    await user.type(passwordInput(), 'senha-de-teste');
    await user.click(submitButton());

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.queryByText('Informe a senha.')).not.toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('a mensagem some quando o campo é corrigido', async () => {
    const { user } = renderLoginPage();

    await user.click(submitButton());
    expect(await screen.findByText('Informe a senha.')).toBeInTheDocument();

    await user.type(passwordInput(), 's');

    expect(screen.queryByText('Informe a senha.')).not.toBeInTheDocument();
    expect(passwordInput()).not.toHaveAttribute('aria-invalid');
  });

  // Os espaços em volta somem antes de chegar à API. Quem tira primeiro é o próprio campo
  // type="email" (o navegador, e o jsdom, limpam o valor); o .trim() do schema é a segunda garantia.
  it('envia o e-mail sem espaços e volta para a página pedida, com os filtros', async () => {
    const { login, user } = renderLoginPage({ from: { pathname: '/tickets', search: '?status=OPEN' } });

    await user.type(emailInput(), '  ana@deskflow.example  ');
    await user.type(passwordInput(), 'senha-de-teste');
    await user.click(submitButton());

    expect(await screen.findByText('Você está em /tickets?status=OPEN')).toBeInTheDocument();
    expect(login).toHaveBeenCalledExactlyOnceWith({ email: 'ana@deskflow.example', password: 'senha-de-teste' });
  });

  it('mostra a mensagem da API quando o login é recusado', async () => {
    const response = {
      status: 401,
      data: { error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' } },
    } as AxiosResponse;
    const login = vi
      .fn<AuthContextValue['login']>()
      .mockRejectedValue(new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, response));
    const { user } = renderLoginPage({ login });

    await user.type(emailInput(), 'ana@deskflow.example');
    await user.type(passwordInput(), 'senha-errada');
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.');
    expect(submitButton()).toBeEnabled();
  });
});
