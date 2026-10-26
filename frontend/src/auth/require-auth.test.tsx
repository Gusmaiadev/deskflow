import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';
import { RequireAuth } from './require-auth';

/** No login, mostra para onde ele devolveria a pessoa. */
function LoginSpy() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from;
  return <p>Voltar para: {from?.pathname ?? 'nada'}</p>;
}

function renderProtectedPage(status: AuthStatus) {
  const auth: AuthContextValue = { status, user: null, login: vi.fn(), logout: vi.fn() };

  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/tickets/42']}>
        <Routes>
          <Route path="/login" element={<LoginSpy />} />
          <Route element={<RequireAuth />}>
            <Route path="/tickets/:id" element={<p>Chamado</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('RequireAuth', () => {
  it('sem sessão, manda para o login lembrando a página', () => {
    renderProtectedPage('anonymous');

    expect(screen.getByText('Voltar para: /tickets/42')).toBeInTheDocument();
  });

  it('depois do "Sair", manda para o login sem lembrar a página de quem saiu', () => {
    renderProtectedPage('signed-out');

    expect(screen.getByText('Voltar para: nada')).toBeInTheDocument();
  });
});
