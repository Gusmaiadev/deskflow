import express from 'express';

// A aplicação express é um função que recebe uma requisição (req) e produz uma resposta (res)
export const app = express();

// Middleware roda antes das rotas definidas, este lê o corpo JSON das requisições e tranforma em obj JavaScript
app.use(express.json());

// Healt check: rota que mostra que está rodando
app.get('/health', (_req, res) => {
  res.status(200).json({
    status:'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
})
