/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Em desenvolvimento, o navegador chama /api no próprio endereço do Vite (localhost:5173),
// e o Vite repassa para a API (localhost:3333). Para o navegador, é tudo o mesmo site:
// o cookie do refresh token funciona e não há CORS envolvido. Em produção, a Vercel faz o mesmo papel.
const apiProxy = {
  '/api': 'http://localhost:3333',
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
    },
  },
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  // Testes de componente (npm test): o jsdom simula o navegador dentro do Node.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
