import type { Role } from '../src/generated/prisma/client.js';

// Usuários e categorias de exemplo. Ficam fora do seed.ts porque o reset da demo
// (reset-demo.ts) também precisa saber quais são os originais.

export const users: { key: string; name: string; email: string; role: Role }[] = [
  { key: 'admin', name: 'Marina Costa', email: 'admin@deskflow.example', role: 'ADMIN' },
  { key: 'rafael', name: 'Rafael Lima', email: 'rafael@deskflow.example', role: 'AGENT' },
  { key: 'juliana', name: 'Juliana Alves', email: 'juliana@deskflow.example', role: 'AGENT' },
  { key: 'ana', name: 'Ana Souza', email: 'ana@deskflow.example', role: 'REQUESTER' },
  { key: 'bruno', name: 'Bruno Mendes', email: 'bruno@deskflow.example', role: 'REQUESTER' },
];

export const categories: { key: string; name: string; description: string }[] = [
  { key: 'access', name: 'Acesso e senhas', description: 'Bloqueios, redefinição de senha e permissões' },
  { key: 'hardware', name: 'Hardware', description: 'Computadores, impressoras e periféricos' },
  { key: 'software', name: 'Software', description: 'Instalação e erros em programas' },
  { key: 'network', name: 'Rede e internet', description: 'Wi-Fi, VPN e conectividade' },
  { key: 'facilities', name: 'Manutenção predial', description: 'Ar-condicionado, iluminação e mobiliário' },
];
