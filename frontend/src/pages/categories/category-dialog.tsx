import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, LoaderCircle, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useCreateCategory, useUpdateCategory } from '@/api/categories';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import type { Category } from '@/types/api';

// As mesmas regras do createCategorySchema e do updateCategorySchema do backend (Dia 3).
const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome precisa ter pelo menos 2 caracteres.')
    .max(60, 'O nome pode ter no máximo 60 caracteres.'),
  description: z.string().trim().max(255, 'A descrição pode ter no máximo 255 caracteres.'),
});

type CategoryForm = z.infer<typeof categorySchema>;

const EMPTY_FORM: CategoryForm = { name: '', description: '' };

/** Sem "category", cadastra uma nova; com ela, edita o nome e a descrição. */
export function CategoryDialog({ category }: { category?: Category }) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CategoryForm>({ resolver: zodResolver(categorySchema), defaultValues: EMPTY_FORM });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setFormError(null);
    // Ao abrir, a edição parte da categoria como ela está agora; o cadastro, de um formulário vazio.
    if (next) reset(category ? { name: category.name, description: category.description ?? '' } : EMPTY_FORM);
  }

  const onSubmit = handleSubmit(async (values) => {
    if (category && !isDirty) {
      handleOpenChange(false);
      return;
    }

    setFormError(null);
    try {
      if (category) {
        // Descrição apagada: null remove a que existia.
        await updateCategory.mutateAsync({
          id: category.id,
          changes: { name: values.name, description: values.description || null },
        });
        toast.success(`Categoria ${values.name} atualizada.`);
      } else {
        const created = await createCategory.mutateAsync({
          name: values.name,
          description: values.description || undefined,
        });
        toast.success(`Categoria ${created.name} cadastrada.`);
      }
      handleOpenChange(false);
    } catch (error) {
      // Nome repetido: o erro aparece no próprio campo, que é onde a pessoa vai corrigir.
      if (getErrorCode(error) === 'CATEGORY_NAME_IN_USE') {
        setError('name', { message: getErrorMessage(error) });
      } else {
        setFormError(getErrorMessage(error));
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {category ? (
          <Button variant="ghost" size="icon" aria-label={`Editar ${category.name}`}>
            <Pencil aria-hidden="true" />
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden="true" />
            Nova categoria
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? `Editar ${category.name}` : 'Nova categoria'}</DialogTitle>
          <DialogDescription>
            {category
              ? 'O novo nome aparece também nos chamados que já usam esta categoria.'
              : 'Ela aparece para todos ao abrir um chamado.'}
          </DialogDescription>
        </DialogHeader>

        <form id="category-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="category-name">Nome</Label>
            <Input id="category-name" aria-invalid={errors.name ? true : undefined} {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="category-description">Descrição (opcional)</Label>
            <Textarea
              id="category-description"
              rows={3}
              aria-invalid={errors.description ? true : undefined}
              {...register('description')}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {category ? 'Salvar' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
