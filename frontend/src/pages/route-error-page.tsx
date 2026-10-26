import { TriangleAlert } from 'lucide-react';
import { useRouteError } from 'react-router';
import { EmptyState } from '@/components/feedback';
import { Button } from '@/components/ui/button';

/**
 * Tela para erros inesperados ao desenhar uma página (um bug, ou um arquivo que não carregou).
 * Caso comum: logo depois de um deploy, quem estava com a versão antiga aberta tenta abrir
 * uma página carregada sob demanda, cujo arquivo antigo não existe mais. Recarregar resolve.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  console.error(error);

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <EmptyState
        icon={TriangleAlert}
        title="Algo deu errado nesta tela"
        description="Recarregue a página. Se o problema continuar, avise o suporte."
        action={<Button onClick={() => window.location.reload()}>Recarregar</Button>}
      />
    </div>
  );
}
