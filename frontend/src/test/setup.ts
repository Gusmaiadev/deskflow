import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Matchers do jest-dom (toBeInTheDocument, toHaveAttribute...) e uma tela limpa entre os testes.
afterEach(() => {
  cleanup();
});
