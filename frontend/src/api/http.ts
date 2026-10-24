import axios from 'axios';

/**
 * Cliente "cru", sem interceptors. Usado só pelas rotas de autenticação,
 * para que uma falha no refresh nunca dispare outro refresh (um loop infinito).
 *
 * baseURL "/api": o navegador chama o próprio endereço do site. No seu PC, o Vite
 * repassa para a API; na Vercel, a Vercel repassa para o CloudFront. Por isso não
 * existe URL de API no código.
 */
export const http = axios.create({ baseURL: '/api' });
