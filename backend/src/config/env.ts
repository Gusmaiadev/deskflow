import { z } from 'zod';

// Mensagens padrão de validação do Zod em português, para a aplicação inteira.
z.config(z.locales.pt());

/**
 * Todas as variáveis de ambiente da API, validadas uma única vez na inicialização.
 * O resto do código importa "env" daqui e nunca lê process.env diretamente.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'DATABASE_URL deve começar com postgresql://'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET precisa ter pelo menos 32 caracteres.'),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  /** Quantos proxies confiáveis ficam na frente da API (0 = nenhum; CloudFront = 1). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  /** Segredo que o CloudFront envia no header X-Origin-Verify. Sem ele, a verificação fica desligada. */
  ORIGIN_SECRET: z.string().min(32, 'ORIGIN_SECRET precisa ter pelo menos 32 caracteres.').optional(),
  /** Contas de demonstração, com a senha publicada no README: não trocam a senha nem são alteradas pelo admin. Separe por vírgula. */
  DEMO_ACCOUNT_EMAILS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    )
    .pipe(z.array(z.email('DEMO_ACCOUNT_EMAILS deve ter só e-mails, separados por vírgula.'))),
  /** Categorias da demonstração: o admin não as altera (nome, descrição ou status). Separe por vírgula. */
  DEMO_CATEGORY_NAMES: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
