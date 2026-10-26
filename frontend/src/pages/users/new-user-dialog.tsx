import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, LoaderCircle, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useCreateUser } from '@/api/users';
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
import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { ROLE_LABELS } from '@/lib/labels';
import type { Role } from '@/types/api';

// As mesmas regras do createUserSchema do backend (Dia 3).
const newUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'O nome precisa ter pelo menos 2 caracteres.')
    .max(100, 'O nome pode ter no máximo 100 caracteres.'),
  email: z.string().trim().pipe(z.email('Informe um e-mail válido.')),
  password: z
    .string()
    .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
    .max(128, 'A senha pode ter no máximo 128 caracteres.'),
  role: z.enum(['REQUESTER', 'AGENT', 'ADMIN']),
});

type NewUserForm = z.infer<typeof newUserSchema>;

const EMPTY_FORM: NewUserForm = { name: '', email: '', password: '', role: 'REQUESTER' };
const ROLES: Role[] = ['REQUESTER', 'AGENT', 'ADMIN'];

export function NewUserDialog() {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const createUser = useCreateUser();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NewUserForm>({ resolver: zodResolver(newUserSchema), defaultValues: EMPTY_FORM });

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
      const user = await createUser.mutateAsync(values);
      toast.success(`${user.name} foi cadastrado como ${ROLE_LABELS[user.role]}.`);
      handleOpenChange(false);
    } catch (error) {
      // E-mail repetido: o erro aparece no próprio campo, que é onde a pessoa vai corrigir.
      if (getErrorCode(error) === 'EMAIL_IN_USE') {
        setError('email', { message: getErrorMessage(error) });
      } else {
        setFormError(getErrorMessage(error));
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden="true" />
          Novo usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>Passe a senha inicial para a pessoa por um canal seguro.</DialogDescription>
        </DialogHeader>

        <form id="new-user-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="user-name">Nome</Label>
            <Input id="user-name" aria-invalid={errors.name ? true : undefined} {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="user-email">E-mail</Label>
            <Input
              id="user-email"
              type="email"
              autoComplete="off"
              aria-invalid={errors.email ? true : undefined}
              {...register('email')}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="user-password">Senha inicial</Label>
            <Input
              id="user-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? true : undefined}
              {...register('password')}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="user-role">Perfil</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="user-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="new-user-form" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            Cadastrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
