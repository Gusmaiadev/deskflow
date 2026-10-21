import { prisma } from '../src/database/prisma.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { calculateDueAt } from '../src/modules/tickets/ticket-sla.js';
import type { Role, TicketPriority, TicketStatus } from '../src/generated/prisma/client.js';

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

const seedPassword = process.env.SEED_USER_PASSWORD;

if (!seedPassword || seedPassword.length < 8) {
  throw new Error('Defina SEED_USER_PASSWORD no .env (mínimo de 8 caracteres) antes de rodar o seed.');
}

const HOUR_IN_MS = 60 * 60 * 1000;

/** Data de "n horas atrás", para simular chamados abertos em momentos diferentes. */
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * HOUR_IN_MS);
}

// ---------------------------------------------------------------------------
// Dados de exemplo
// ---------------------------------------------------------------------------

const users: { key: string; name: string; email: string; role: Role }[] = [
  { key: 'admin', name: 'Marina Costa', email: 'admin@deskflow.example', role: 'ADMIN' },
  { key: 'rafael', name: 'Rafael Lima', email: 'rafael@deskflow.example', role: 'AGENT' },
  { key: 'juliana', name: 'Juliana Alves', email: 'juliana@deskflow.example', role: 'AGENT' },
  { key: 'ana', name: 'Ana Souza', email: 'ana@deskflow.example', role: 'REQUESTER' },
  { key: 'bruno', name: 'Bruno Mendes', email: 'bruno@deskflow.example', role: 'REQUESTER' },
];

const categories: { key: string; name: string; description: string }[] = [
  { key: 'access', name: 'Acesso e senhas', description: 'Bloqueios, redefinição de senha e permissões' },
  { key: 'hardware', name: 'Hardware', description: 'Computadores, impressoras e periféricos' },
  { key: 'software', name: 'Software', description: 'Instalação e erros em programas' },
  { key: 'network', name: 'Rede e internet', description: 'Wi-Fi, VPN e conectividade' },
  { key: 'facilities', name: 'Manutenção predial', description: 'Ar-condicionado, iluminação e mobiliário' },
];

type SeedComment = { author: string; body: string; isInternal?: boolean; hoursAgo: number };

type SeedTicket = {
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  category: string;
  requester: string;
  assignee?: string;
  openedHoursAgo: number;
  waitingHoursAgo?: number; // desde quando aguarda o solicitante (SLA pausado)
  resolvedHoursAgo?: number;
  closedHoursAgo?: number;
  comments?: SeedComment[];
};

const tickets: SeedTicket[] = [
  {
    title: 'Notebook não liga após atualização',
    description: 'Depois da atualização de ontem o notebook fica com a tela preta ao ligar.',
    priority: 'HIGH', status: 'CLOSED', category: 'hardware', requester: 'ana', assignee: 'rafael',
    openedHoursAgo: 120, resolvedHoursAgo: 116, closedHoursAgo: 110,
    comments: [
      { author: 'rafael', body: 'Vou passar na sua mesa em 30 minutos.', hoursAgo: 119 },
      { author: 'rafael', body: 'Driver de vídeo corrompido. Reinstalado.', isInternal: true, hoursAgo: 117 },
      { author: 'ana', body: 'Funcionou, obrigada!', hoursAgo: 115 },
    ],
  },
  {
    title: 'Solicitar acesso à pasta Financeiro',
    description: 'Preciso de acesso de leitura à pasta compartilhada do Financeiro.',
    priority: 'LOW', status: 'RESOLVED', category: 'access', requester: 'bruno', assignee: 'juliana',
    openedHoursAgo: 96, resolvedHoursAgo: 70,
    comments: [{ author: 'juliana', body: 'Acesso liberado. Confirme se consegue abrir.', hoursAgo: 70 }],
  },
  {
    title: 'Ar-condicionado da sala 3 pingando',
    description: 'O aparelho está pingando sobre a mesa de reunião.',
    priority: 'MEDIUM', status: 'WAITING_REQUESTER', category: 'facilities', requester: 'ana', assignee: 'juliana',
    openedHoursAgo: 30, waitingHoursAgo: 26,
    comments: [
      { author: 'juliana', body: 'Técnico agendado. Qual o melhor horário para a visita?', hoursAgo: 26 },
      { author: 'juliana', body: 'Fornecedor cobra visita extra após as 18h.', isInternal: true, hoursAgo: 25 },
    ],
  },
  {
    title: 'VPN desconectando a cada 10 minutos',
    description: 'Em home office a VPN cai com frequência e perco o trabalho em andamento.',
    priority: 'HIGH', status: 'IN_PROGRESS', category: 'network', requester: 'bruno', assignee: 'rafael',
    openedHoursAgo: 20,
    comments: [{ author: 'rafael', body: 'Coletando logs do cliente VPN.', hoursAgo: 18 }],
  },
  {
    title: 'Impressora do 2º andar com papel preso',
    description: 'A impressora exibe erro de papel preso, mas não há papel visível.',
    priority: 'LOW', status: 'OPEN', category: 'hardware', requester: 'bruno',
    openedHoursAgo: 10,
  },
  {
    title: 'Erro ao abrir o sistema de notas fiscais',
    description: 'Mensagem "licença expirada" ao abrir o emissor de notas.',
    priority: 'URGENT', status: 'OPEN', category: 'software', requester: 'ana',
    openedHoursAgo: 6,
  },
  {
    title: 'Senha bloqueada no e-mail',
    description: 'Errei a senha algumas vezes e a conta foi bloqueada.',
    priority: 'MEDIUM', status: 'IN_PROGRESS', category: 'access', requester: 'ana', assignee: 'juliana',
    openedHoursAgo: 3,
  },
  {
    title: 'Instalar software de design',
    description: 'Preciso do editor de imagens instalado para a campanha de marketing.',
    priority: 'LOW', status: 'OPEN', category: 'software', requester: 'bruno',
    openedHoursAgo: 1,
  },
];

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('🌱 Iniciando o seed...');

  // 1) Usuários: upsert = cria se não existe, atualiza se já existe (seed idempotente).
  const userIds = new Map<string, string>();
  for (const user of users) {
    const passwordHash = await hashPassword(seedPassword!);
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash, isActive: true },
      create: { name: user.name, email: user.email, role: user.role, passwordHash },
    });
    userIds.set(user.key, saved.id);
  }
  console.log(`👤 ${userIds.size} usuários prontos.`);

  // 2) Categorias: mesmo raciocínio do upsert.
  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { name: category.name },
      update: { description: category.description, isActive: true },
      create: { name: category.name, description: category.description },
    });
    categoryIds.set(category.key, saved.id);
  }
  console.log(`🗂️  ${categoryIds.size} categorias prontas.`);

  // 3) Chamados: só cria se a tabela estiver vazia, para não duplicar a cada execução.
  const existingTickets = await prisma.ticket.count();
  if (existingTickets > 0) {
    console.log(`🎫 Já existem ${existingTickets} chamados. Nenhum chamado novo foi criado.`);
    return;
  }

  const idOf = (map: Map<string, string>, key: string): string => {
    const id = map.get(key);
    if (!id) throw new Error(`Chave desconhecida no seed: ${key}`);
    return id;
  };

  // Ordena do mais antigo para o mais novo, para o número (#1, #2...) seguir a ordem de abertura.
  const ordered = [...tickets].sort((a, b) => b.openedHoursAgo - a.openedHoursAgo);

  // Transação: ou todos os chamados são criados, ou nenhum é (tudo ou nada).
  await prisma.$transaction(
    async (tx) => {
      for (const ticket of ordered) {
        const openedAt = hoursAgo(ticket.openedHoursAgo);

        await tx.ticket.create({
          data: {
            title: ticket.title,
            description: ticket.description,
            priority: ticket.priority,
            status: ticket.status,
            createdAt: openedAt,
            dueAt: calculateDueAt(ticket.priority, openedAt),
            waitingSince: ticket.waitingHoursAgo ? hoursAgo(ticket.waitingHoursAgo) : null,
            resolvedAt: ticket.resolvedHoursAgo ? hoursAgo(ticket.resolvedHoursAgo) : null,
            closedAt: ticket.closedHoursAgo ? hoursAgo(ticket.closedHoursAgo) : null,
            requester: { connect: { id: idOf(userIds, ticket.requester) } },
            category: { connect: { id: idOf(categoryIds, ticket.category) } },
            ...(ticket.assignee && { assignee: { connect: { id: idOf(userIds, ticket.assignee) } } }),
            comments: {
              create: (ticket.comments ?? []).map((comment) => ({
                body: comment.body,
                isInternal: comment.isInternal ?? false,
                createdAt: hoursAgo(comment.hoursAgo),
                author: { connect: { id: idOf(userIds, comment.author) } },
              })),
            },
          },
        });
      }
    },
    { timeout: 20_000 },
  );

  console.log(`🎫 ${ordered.length} chamados criados com comentários.`);
}

main()
  .then(() => console.log('✅ Seed concluído.'))
  .catch((error: unknown) => {
    console.error('❌ Falha no seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
