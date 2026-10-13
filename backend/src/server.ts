import { createServer } from 'node:http';
import { app } from './app.js';
import { prisma } from './database/prisma.js';

const PORT = Number(process.env.PORT) || 3333;

const server = createServer(app);

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ A porta ${PORT} já está em uso. Encerre o outro processo ou altere PORT no .env.`);
  } else {
    console.error('❌ Falha ao iniciar o servidor:', error);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`🚀 API do DeskFlow rodando em http://localhost:${PORT}`);
});

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} recebido. Encerrando com segurança...`);

  const forceExit = setTimeout(() => {
    console.error('⚠️ O encerramento demorou demais. Forçando a saída.');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    await prisma.$disconnect();
    console.log('✅ Servidor e conexões com o banco encerrados.');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
