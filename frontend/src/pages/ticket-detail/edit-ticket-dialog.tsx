import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, LoaderCircle, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useUpdateTicket } from '@/api/tickets';
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
import { ticketDescriptionSchema, ticketTitleSchema } from '@/lib/ticket-schema';
import type { TicketDetail } from '@/types/api';

const editTicketSchema = z.object({
  title: ticketTitleSchema,
  description: ticketDescriptionSchema,
});

type EditTicketForm = z.infer<typeof editTicketSchema>;

// Erros que tornam a edição impossível: não adianta manter o formulário aberto.
const NOT_EDITABLE_CODES = ['TICKET_NOT_EDITABLE', 'TICKET_CLOSED'];

export function EditTicketDialog({ ticket }: { ticket: TicketDetail }) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const update = useUpdateTicket(ticket.id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<EditTicketForm>({ resolver: zodResolver(editTicketSchema) });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setFormError(null);
    // Ao abrir, o formulário parte do chamado como ele está agora (o cache pode ter mudado desde a última vez).
    if (next) reset({ title: ticket.title, description: ticket.description });
  }

  const onSubmit = handleSubmit(async (values) => {
    // Nada mudou: fechar basta, sem gravar.
    if (!isDirty) {
      handleOpenChange(false);
      return;
    }

    setFormError(null);
    try {
      await update.mutateAsync(values);
      toast.success('Chamado atualizado.');
      handleOpenChange(false);
    } catch (error) {
      // Um técnico começou o atendimento enquanto o formulário estava aberto: o botão de editar
      // some quando o chamado é recarregado, então o aviso vai para o toast.
      if (NOT_EDITABLE_CODES.includes(getErrorCode(error) ?? '')) {
        toast.error(getErrorMessage(error));
        handleOpenChange(false);
        return;
      }
      setFormError(getErrorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil aria-hidden="true" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar o chamado #{ticket.number}</DialogTitle>
          <DialogDescription>Dá para corrigir o título e a descrição até um técnico começar o atendimento.</DialogDescription>
        </DialogHeader>

        <form id="edit-ticket-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-title">Título</Label>
            <Input id="edit-title" aria-invalid={errors.title ? true : undefined} {...register('title')} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Textarea
              id="edit-description"
              rows={8}
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
          <Button type="submit" form="edit-ticket-form" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
