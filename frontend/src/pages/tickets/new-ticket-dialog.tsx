import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, LoaderCircle, Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { useCategories } from '@/api/categories';
import { useCreateTicket } from '@/api/tickets';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { PRIORITY_OPTIONS } from '@/lib/labels';

// As mesmas regras do createTicketSchema do backend (Dia 4).
const newTicketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'O título precisa ter pelo menos 5 caracteres.')
    .max(150, 'O título pode ter no máximo 150 caracteres.'),
  description: z
    .string()
    .trim()
    .min(10, 'Descreva o problema com pelo menos 10 caracteres.')
    .max(5000, 'A descrição pode ter no máximo 5000 caracteres.'),
  categoryId: z.string().min(1, 'Escolha uma categoria.'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
});

type NewTicketForm = z.infer<typeof newTicketSchema>;

const EMPTY_FORM: NewTicketForm = { title: '', description: '', categoryId: '', priority: 'MEDIUM' };

export function NewTicketDialog() {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  const categories = useCategories();
  const createTicket = useCreateTicket();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewTicketForm>({ resolver: zodResolver(newTicketSchema), defaultValues: EMPTY_FORM });

  // Só categorias ativas aceitam chamados novos (o admin recebe também as desativadas).
  const activeCategories = (categories.data ?? []).filter((category) => category.isActive);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset(EMPTY_FORM);
      setFormError(null);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const ticket = await createTicket.mutateAsync(values);
      toast.success(`Chamado #${ticket.number} aberto.`);
      handleOpenChange(false);
      navigate(`/tickets/${ticket.id}`);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          Novo chamado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo chamado</DialogTitle>
          <DialogDescription>Conte o que está acontecendo. A equipe de suporte responde por aqui.</DialogDescription>
        </DialogHeader>

        <form id="new-ticket-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              placeholder="Ex.: Impressora do 3º andar sem conexão"
              aria-invalid={errors.title ? true : undefined}
              {...register('title')}
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              rows={5}
              placeholder="O que aconteceu, desde quando, e o que você já tentou."
              aria-invalid={errors.description ? true : undefined}
              {...register('description')}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoryId">Categoria</Label>
              {/* O Select do Radix não é um <input>: o Controller faz a ponte com o formulário. */}
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="categoryId"
                      className="w-full"
                      aria-invalid={errors.categoryId ? true : undefined}
                    >
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="priority">Urgência</Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Prazo de atendimento: urgente 4 h · alta 8 h · média 24 h · baixa 72 h.
          </p>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="new-ticket-form" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Abrir chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
