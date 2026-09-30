import { createServer } from 'node:http';
import { app } from './app.js';

// Esse arquivo tem como objetivo definir como a API é exposta, definindo a porta e o que fazer caso falhe
const PORT = Number(process.env.PORT) || 3333;

// O Express não abre postas sozinho, isso é trabalho do servidor HTTP que é nativo do node
// O app é passado como uma função que trata cada requisição
const server = createServer(app);

server.on('error', (error: NodeJS.ErrnoException)=>{
  if(error.code === 'EADDRINUSE') {
    console.error(`a porta ${PORT} já está em uso. Encerre o outro processo ou altere PORT no .env`);
  } else {
    console.error('Falha ao iniciar o servidor', error);
  }
  process.exit(1);
});

server.listen(PORT, () =>{
  console.log(`API do Deskoflow rodando em http://localhost:${PORT}`);
})
