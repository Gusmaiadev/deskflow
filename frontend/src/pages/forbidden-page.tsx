import { ShieldX } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/lib/use-document-title';

export function ForbiddenPage() {
  useDocumentTitle('Sem permissão');

  return (
    <EmptyState
      icon={ShieldX}
      title="Você não tem acesso a esta página"
      description="Ela é exclusiva de outro perfil. Se acha que é um engano, fale com o administrador."
      action={
        <Button asChild variant="outline">
          <Link to="/">Voltar ao início</Link>
        </Button>
      }
    />
  );
}
