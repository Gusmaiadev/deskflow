import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, LoaderCircle, MessageSquare, Send } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useComments, useCreateComment } from '@/api/comments';
import { EmptyState, ErrorState } from '@/components/feedback';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime, formatRelative, initials } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type { Comment, TicketDetail } from '@/types/api';

const commentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Escreva o comentário.')
    .max(5000, 'O comentário pode ter no máximo 5000 caracteres.'),
  isInternal: z.boolean(),
});

type CommentForm = z.infer<typeof commentSchema>;

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <li
      className={cn(
        'flex gap-3 rounded-lg border p-3',
        // Nota interna: destaque em âmbar, para a equipe nunca confundir com uma resposta ao solicitante.
        comment.isInternal && 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
      )}
    >
      <Avatar className="size-8">
        <AvatarFallback className="text-xs">{initials(comment.author.name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">{comment.author.name}</span>
          <span className="text-xs text-muted-foreground">{ROLE_LABELS[comment.author.role]}</span>
          <span className="text-xs text-muted-foreground" title={formatDateTime(comment.createdAt)}>
            {formatRelative(comment.createdAt)}
          </span>
          {comment.isInternal && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300">
              <Lock className="size-3" aria-hidden="true" />
              Nota interna
            </span>
          )}
        </div>
        {/* whitespace-pre-wrap: mantém as quebras de linha que a pessoa digitou */}
        <p className="text-sm break-words whitespace-pre-wrap">{comment.body}</p>
      </div>
    </li>
  );
}

export function CommentsSection({ ticket, isStaff }: { ticket: TicketDetail; isStaff: boolean }) {
  const comments = useComments(ticket.id);
  const createComment = useCreateComment(ticket.id);
  const closed = ticket.status === 'CLOSED';

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommentForm>({
    resolver: zodResolver(commentSchema),
    defaultValues: { body: '', isInternal: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await createComment.mutateAsync(values);
      reset({ body: '', isInternal: false });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversa</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {comments.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Carregando comentários">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : comments.isError ? (
          <ErrorState message={getErrorMessage(comments.error)} onRetry={() => void comments.refetch()} />
        ) : comments.data.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Nenhum comentário ainda" />
        ) : (
          <ol className="flex flex-col gap-3" aria-label="Comentários">
            {comments.data.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </ol>
        )}

        {closed ? (
          <p className="text-sm text-muted-foreground">Chamado fechado: não aceita novos comentários.</p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
            <Label htmlFor="comment-body" className="sr-only">
              Novo comentário
            </Label>
            <Textarea
              id="comment-body"
              rows={3}
              placeholder={isStaff ? 'Responda ao solicitante ou registre uma nota' : 'Escreva uma resposta'}
              aria-invalid={errors.body ? true : undefined}
              {...register('body')}
            />
            {errors.body && <p className="text-sm text-destructive">{errors.body.message}</p>}

            <div className="flex flex-wrap items-center justify-between gap-3">
              {isStaff ? (
                <div className="flex items-center gap-2">
                  <Controller
                    name="isInternal"
                    control={control}
                    render={({ field }) => (
                      <Checkbox
                        id="comment-internal"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    )}
                  />
                  <Label htmlFor="comment-internal" className="font-normal">
                    Nota interna (o solicitante não vê)
                  </Label>
                </div>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Send aria-hidden="true" />
                )}
                Enviar
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
