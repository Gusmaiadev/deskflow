import { z } from 'zod';
import { Role, TicketPriority, TicketStatus } from '../generated/prisma/enums.js';
import { loginSchema } from '../modules/auth/auth.schemas.js';
import { createCategorySchema, updateCategorySchema } from '../modules/categories/categories.schemas.js';
import { createCommentSchema } from '../modules/comments/comments.schemas.js';
import { createTicketSchema, listTicketsQuerySchema, updateTicketSchema } from '../modules/tickets/tickets.schemas.js';
import { createUserSchema, listUsersQuerySchema, updateUserSchema } from '../modules/users/users.schemas.js';

type JsonObject = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Ajudantes
// ---------------------------------------------------------------------------

/** Converte um schema Zod em JSON Schema: a documentação usa as MESMAS regras da validação. */
function fromZod(schema: z.ZodType): JsonObject {
  const { $schema: _dialect, ...jsonSchema } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  return jsonSchema;
}

/** Cada campo de um schema de query string vira um parâmetro da URL. */
function queryParameters(schema: z.ZodObject): JsonObject[] {
  return Object.entries(schema.shape).map(([name, field]) => ({
    name,
    in: 'query',
    required: false,
    schema: fromZod(field as z.ZodType),
  }));
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const jsonBody = (schema: JsonObject) => ({
  required: true,
  content: { 'application/json': { schema } },
});

const dataResponse = (description: string, schema: JsonObject) => ({
  description,
  content: {
    'application/json': { schema: { type: 'object', properties: { data: schema }, required: ['data'] } },
  },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ref('Error') } },
});

const pathId = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', format: 'uuid' },
});

const bearer = [{ bearerAuth: [] }];
const refreshCookie = [{ refreshCookie: [] }];

const errors = {
  400: errorResponse('Dados inválidos'),
  401: errorResponse('Não autenticado: token ausente, inválido ou expirado'),
  403: errorResponse('Sem permissão para esta ação'),
  404: errorResponse('Não encontrado (ou sem acesso)'),
  409: errorResponse('Conflito com o estado atual do recurso'),
  429: errorResponse('Limite de requisições atingido'),
};

// ---------------------------------------------------------------------------
// Formatos de resposta (DTOs de saída)
// ---------------------------------------------------------------------------

const uuid = { type: 'string', format: 'uuid' };
const dateTime = { type: 'string', format: 'date-time' };
const nullableDateTime = { type: ['string', 'null'], format: 'date-time' };
const person = { type: 'object', properties: { id: uuid, name: { type: 'string' } } };

const schemas = {
  Error: {
    type: 'object',
    properties: {
      error: {
        type: 'object',
        properties: {
          code: { type: 'string', examples: ['VALIDATION_ERROR'] },
          message: { type: 'string' },
          details: { description: 'Detalhes opcionais, como a lista de campos inválidos' },
        },
        required: ['code', 'message'],
      },
    },
    required: ['error'],
  },
  User: {
    type: 'object',
    properties: {
      id: uuid,
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: Object.values(Role) },
      isActive: { type: 'boolean' },
      createdAt: dateTime,
    },
  },
  Session: {
    type: 'object',
    properties: {
      accessToken: { type: 'string', description: 'JWT. Envie no header Authorization: Bearer <token>' },
      tokenType: { type: 'string', const: 'Bearer' },
      expiresIn: { type: 'integer', description: 'Validade do access token, em segundos' },
      user: ref('User'),
    },
  },
  Category: {
    type: 'object',
    properties: {
      id: uuid,
      name: { type: 'string' },
      description: { type: ['string', 'null'] },
      isActive: { type: 'boolean' },
    },
  },
  Ticket: {
    type: 'object',
    properties: {
      id: uuid,
      number: { type: 'integer', description: 'Número amigável, como em "chamado #12"' },
      title: { type: 'string' },
      description: { type: 'string' },
      status: { type: 'string', enum: Object.values(TicketStatus) },
      priority: { type: 'string', enum: Object.values(TicketPriority) },
      isOverdue: { type: 'boolean', description: 'Em andamento e com o prazo do SLA vencido' },
      dueAt: { ...dateTime, description: 'Prazo calculado pelo SLA da prioridade' },
      resolvedAt: nullableDateTime,
      closedAt: nullableDateTime,
      createdAt: dateTime,
      updatedAt: dateTime,
      category: person,
      requester: person,
      assignee: { anyOf: [person, { type: 'null' }] },
    },
  },
  TicketPage: {
    type: 'object',
    properties: {
      data: { type: 'array', items: ref('Ticket') },
      meta: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
    },
  },
  Comment: {
    type: 'object',
    properties: {
      id: uuid,
      body: { type: 'string' },
      isInternal: { type: 'boolean', description: 'Nota interna: visível só para a equipe' },
      createdAt: dateTime,
      author: {
        type: 'object',
        properties: { id: uuid, name: { type: 'string' }, role: { type: 'string', enum: Object.values(Role) } },
      },
    },
  },
  Dashboard: {
    type: 'object',
    description: 'Indicadores do atendimento',
    properties: {
      generatedAt: dateTime,
      summary: { type: 'object', description: 'Em andamento, atrasados, sem responsável e resolvidos em 30 dias' },
      sla: { type: 'object', description: 'Cumprimento do SLA e tempo médio de resolução (últimos 30 dias)' },
      byStatus: { type: 'object', description: 'Total de chamados por status' },
      openByPriority: { type: 'object', description: 'Chamados em andamento por prioridade' },
      openByCategory: { type: 'array', description: 'Chamados em andamento por categoria' },
      createdPerDay: { type: 'array', description: 'Chamados abertos por dia (últimos 7 dias)' },
    },
  },
};

// ---------------------------------------------------------------------------
// O documento
// ---------------------------------------------------------------------------

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'DeskFlow API',
    version: '1.0.0',
    description:
      'API da central de chamados DeskFlow. Para testar: faça login em POST /api/auth/login, ' +
      'copie o accessToken, clique em "Authorize" e cole o token.',
  },
  tags: [
    { name: 'Saúde', description: 'Verificação de funcionamento, usada pela infraestrutura' },
    { name: 'Autenticação', description: 'Login, renovação da sessão e logout' },
    { name: 'Usuários', description: 'Gestão de usuários e perfis' },
    { name: 'Categorias', description: 'Tipos de problema atendidos' },
    { name: 'Chamados', description: 'Abertura, consulta e atendimento de chamados' },
    { name: 'Comentários', description: 'Conversa e notas internas de um chamado' },
    { name: 'Dashboard', description: 'Indicadores para a equipe de suporte' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      refreshCookie: { type: 'apiKey', in: 'cookie', name: 'deskflow_refresh' },
    },
    schemas,
  },
  paths: {
    '/health': {
      get: {
        tags: ['Saúde'],
        summary: 'Saúde da API e do banco',
        security: [], // rota pública
        responses: {
          200: { description: 'API e banco funcionando' },
          503: { description: 'API no ar, mas sem acesso ao banco' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticação'],
        summary: 'Entrar',
        description: 'Devolve o access token no corpo e grava o refresh token no cookie deskflow_refresh.',
        security: [], // rota pública
        requestBody: jsonBody(fromZod(loginSchema)),
        responses: {
          200: dataResponse('Login realizado', ref('Session')),
          400: errors[400],
          401: errors[401],
          429: errors[429],
        },
      },
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Autenticação'],
        summary: 'Renovar a sessão',
        description: 'Usa o cookie de sessão e o troca por um novo (rotação).',
        security: refreshCookie,
        responses: { 200: dataResponse('Sessão renovada', ref('Session')), 401: errors[401], 429: errors[429] },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Autenticação'],
        summary: 'Sair',
        security: refreshCookie,
        responses: { 204: { description: 'Sessão encerrada' }, 429: errors[429] },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Autenticação'],
        summary: 'Usuário logado',
        security: bearer,
        responses: { 200: dataResponse('Dados do usuário', ref('User')), 401: errors[401] },
      },
    },
    '/api/users': {
      get: {
        tags: ['Usuários'],
        summary: 'Listar usuários (técnico e admin)',
        security: bearer,
        parameters: queryParameters(listUsersQuerySchema),
        responses: {
          200: dataResponse('Lista de usuários', { type: 'array', items: ref('User') }),
          400: errors[400],
          401: errors[401],
          403: errors[403],
        },
      },
      post: {
        tags: ['Usuários'],
        summary: 'Criar usuário (admin)',
        security: bearer,
        requestBody: jsonBody(fromZod(createUserSchema)),
        responses: {
          201: dataResponse('Usuário criado', ref('User')),
          400: errors[400],
          401: errors[401],
          403: errors[403],
          409: errors[409],
        },
      },
    },
    '/api/users/{id}': {
      patch: {
        tags: ['Usuários'],
        summary: 'Alterar nome, perfil ou status (admin)',
        security: bearer,
        parameters: [pathId('id', 'Id do usuário')],
        requestBody: jsonBody(fromZod(updateUserSchema)),
        responses: {
          200: dataResponse('Usuário atualizado', ref('User')),
          400: errors[400],
          401: errors[401],
          403: errors[403],
          404: errors[404],
        },
      },
    },
    '/api/categories': {
      get: {
        tags: ['Categorias'],
        summary: 'Listar categorias',
        description: 'O admin vê todas; os demais perfis, só as ativas.',
        security: bearer,
        responses: { 200: dataResponse('Lista de categorias', { type: 'array', items: ref('Category') }), 401: errors[401] },
      },
      post: {
        tags: ['Categorias'],
        summary: 'Criar categoria (admin)',
        security: bearer,
        requestBody: jsonBody(fromZod(createCategorySchema)),
        responses: {
          201: dataResponse('Categoria criada', ref('Category')),
          400: errors[400],
          401: errors[401],
          403: errors[403],
          409: errors[409],
        },
      },
    },
    '/api/categories/{id}': {
      patch: {
        tags: ['Categorias'],
        summary: 'Alterar ou desativar categoria (admin)',
        security: bearer,
        parameters: [pathId('id', 'Id da categoria')],
        requestBody: jsonBody(fromZod(updateCategorySchema)),
        responses: {
          200: dataResponse('Categoria atualizada', ref('Category')),
          400: errors[400],
          401: errors[401],
          403: errors[403],
          404: errors[404],
          409: errors[409],
        },
      },
    },
    '/api/tickets': {
      get: {
        tags: ['Chamados'],
        summary: 'Listar chamados com filtros, busca e paginação',
        description: 'O solicitante vê só os próprios chamados; técnicos e admins veem todos.',
        security: bearer,
        parameters: queryParameters(listTicketsQuerySchema),
        responses: {
          200: { description: 'Uma página de chamados', content: { 'application/json': { schema: ref('TicketPage') } } },
          400: errors[400],
          401: errors[401],
        },
      },
      post: {
        tags: ['Chamados'],
        summary: 'Abrir chamado',
        description: 'O prazo (dueAt) é calculado pelo SLA da prioridade.',
        security: bearer,
        requestBody: jsonBody(fromZod(createTicketSchema)),
        responses: {
          201: dataResponse('Chamado aberto', ref('Ticket')),
          400: errors[400],
          401: errors[401],
        },
      },
    },
    '/api/tickets/{id}': {
      get: {
        tags: ['Chamados'],
        summary: 'Detalhar chamado',
        security: bearer,
        parameters: [pathId('id', 'Id do chamado')],
        responses: { 200: dataResponse('Chamado', ref('Ticket')), 401: errors[401], 404: errors[404] },
      },
      patch: {
        tags: ['Chamados'],
        summary: 'Alterar chamado (status, prioridade, responsável...)',
        description: 'As mudanças de status seguem o fluxo permitido para o perfil.',
        security: bearer,
        parameters: [pathId('id', 'Id do chamado')],
        requestBody: jsonBody(fromZod(updateTicketSchema)),
        responses: {
          200: dataResponse('Chamado atualizado', ref('Ticket')),
          400: errors[400],
          401: errors[401],
          403: errors[403],
          404: errors[404],
          409: errors[409],
        },
      },
    },
    '/api/tickets/{ticketId}/comments': {
      get: {
        tags: ['Comentários'],
        summary: 'Listar comentários do chamado',
        description: 'Notas internas aparecem só para técnicos e admins.',
        security: bearer,
        parameters: [pathId('ticketId', 'Id do chamado')],
        responses: {
          200: dataResponse('Comentários', { type: 'array', items: ref('Comment') }),
          401: errors[401],
          404: errors[404],
        },
      },
      post: {
        tags: ['Comentários'],
        summary: 'Comentar no chamado',
        security: bearer,
        parameters: [pathId('ticketId', 'Id do chamado')],
        requestBody: jsonBody(fromZod(createCommentSchema)),
        responses: {
          201: dataResponse('Comentário criado', ref('Comment')),
          400: errors[400],
          401: errors[401],
          403: errors[403],
          404: errors[404],
          409: errors[409],
        },
      },
    },
    '/api/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: 'Indicadores do atendimento (técnico e admin)',
        security: bearer,
        responses: { 200: dataResponse('Indicadores', ref('Dashboard')), 401: errors[401], 403: errors[403] },
      },
    },
  },
};
