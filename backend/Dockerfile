# syntax=docker/dockerfile:1

# =====================================================================
# Estágio 1: build
# Instala TODAS as dependências, gera o Prisma Client e compila o
# TypeScript. Deste estágio, só a pasta dist/ vai para a imagem final.
# =====================================================================
FROM node:24-slim AS build

# O CLI do Prisma usa o OpenSSL para identificar e baixar o motor de
# migrations correto. A imagem "slim" não vem com ele.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Manifestos primeiro: aproveita o cache de camadas do Docker.
COPY package.json package-lock.json ./
RUN npm ci

# Depois o código.
COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

# O generate NÃO conecta no banco. A URL fictícia existe só porque o
# prisma.config.ts exige que DATABASE_URL esteja definida.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate \
  && npm run build

# =====================================================================
# Estágio 2: runtime
# A imagem final: só o necessário para RODAR a API.
# =====================================================================
FROM node:24-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./

# --omit=dev: sem ferramentas de desenvolvimento.
# --omit=optional: remove também o CLI do Prisma e o TypeScript, que o
# lockfile marca como "devOptional" (peers opcionais do @prisma/client).
RUN npm ci --omit=dev --omit=optional \
  && npm cache clean --force

COPY --from=build /app/dist ./dist

# Roda como usuário comum, não como root.
USER node

EXPOSE 3333

# "node" direto (e não "npm start") para o processo receber o SIGTERM
# do "docker stop" e encerrar com segurança.
CMD ["node", "--enable-source-maps", "dist/server.js"]
