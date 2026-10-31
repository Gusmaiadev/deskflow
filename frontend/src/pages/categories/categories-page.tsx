import { toast } from 'sonner';
import { useCategories, useUpdateCategory } from '@/api/categories';
import { ErrorState } from '@/components/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getErrorMessage } from '@/lib/errors';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { Category } from '@/types/api';
import { CategoryDialog } from './category-dialog';

export function CategoriesPage() {
  useDocumentTitle('Categorias');
  const categories = useCategories();
  const updateCategory = useUpdateCategory();

  function toggle(category: Category, isActive: boolean) {
    updateCategory.mutate(
      { id: category.id, changes: { isActive } },
      {
        onSuccess: () => {
          toast.success(
            isActive
              ? `${category.name} foi reativada.`
              : `${category.name} foi desativada. Os chamados que já usam a categoria não mudam.`,
          );
        },
        onError: (error) => {
          toast.error(getErrorMessage(error));
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
          <p className="text-sm text-muted-foreground">Os assuntos dos chamados. Só as ativas aceitam chamados novos.</p>
        </div>
        <CategoryDialog />
      </div>

      {categories.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Carregando categorias">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : categories.isError ? (
        <ErrorState message={getErrorMessage(categories.error)} onRetry={() => void categories.refetch()} />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Editar</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.data.map((category) => (
                <TableRow key={category.id} className={category.isActive ? undefined : 'text-muted-foreground'}>
                  <TableCell className="whitespace-normal">
                    <p className="font-medium">{category.name}</p>
                    {category.description && (
                      <p className="text-xs break-words text-muted-foreground">{category.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={category.isActive}
                      disabled={updateCategory.isPending}
                      aria-label={`${category.name} ativa`}
                      onCheckedChange={(isActive) => toggle(category, isActive)}
                    />
                  </TableCell>
                  <TableCell>
                    <CategoryDialog category={category} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
