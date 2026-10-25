import { SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/use-document-title';

export function NotFoundPage() {
  useDocumentTitle('Página não encontrada');

  return (
    <EmptyState
      icon={SearchX}
      title="Página não encontrada"
      description="O endereço pode estar errado, ou a página pode ter mudado de lugar."
      action={
        <Button asChild variant="outline">
          <Link to="/">Voltar ao início</Link>
        </Button>
      }
    />
  );
}
