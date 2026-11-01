// O import() de cada página carregada sob demanda, num lugar só: a rota usa para abrir a página,
// e a lista de chamados usa para baixar o detalhe antes do clique. O navegador guarda o módulo
// baixado, então chamar de novo não repete o download.
export const loadTicketDetailPage = () => import('@/pages/ticket-detail/ticket-detail-page');
