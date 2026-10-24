import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env, isProduction } from './config/env.js';
import { openApiDocument } from './docs/openapi.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { categoriesRoutes } from './modules/categories/categories.routes.js';
import { commentsRoutes } from './modules/comments/comments.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { ticketsRoutes } from './modules/tickets/tickets.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { errorHandler } from './shared/middlewares/error-handler.js';
import { notFoundHandler } from './shared/middlewares/not-found.js';
import { requireOriginSecret } from './shared/middlewares/origin-guard.js';
import { apiRateLimit } from './shared/middlewares/rate-limit.js';

export const app = express();

// Atrás do CloudFront, o IP real do usuário chega no header X-Forwarded-For.
// Dizer quantos proxies são confiáveis faz o req.ip (e o rate limit) usar o IP certo.
// Com 0 (no seu PC), a configuração padrão do Express continua valendo.
if (env.TRUST_PROXY_HOPS > 0) {
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
}

// 1) Proteções que valem para toda requisição
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        // Em produção tudo é HTTPS. Em http://localhost, a troca forçada para HTTPS quebraria a documentação no Safari.
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
  }),
);
// As respostas da API dependem de quem pergunta: nenhum cache (navegador, Vercel ou
// CloudFront) pode guardá-las.
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
// Em produção, /api só aceita o que chegou pelo proxy (Vercel/CloudFront). O /health fica de fora
// porque o healthcheck do Docker o chama de dentro do próprio container.
app.use('/api', requireOriginSecret(env.ORIGIN_SECRET));
app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
app.use('/api', apiRateLimit);

// 2) Leitura da requisição
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// 3) Rotas
app.use(healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/tickets/:ticketId/comments', commentsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 4) Documentação da API
app.get('/api/openapi.json', (_req, res) => {
  res.json(openApiDocument);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'DeskFlow API' }));

// 5) Rota inexistente e tratamento de erros (sempre por último)
app.use(notFoundHandler);
app.use(errorHandler);
