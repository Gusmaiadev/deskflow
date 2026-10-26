import { toast } from 'sonner';
import { useUpdateUser, useUsers, type UserChanges } from '@/api/users';
import { useAuth } from '@/auth/auth-context';
import { ErrorState } from '@/components/feedback';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/labels';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { Role, User } from '@/types/api';
import { NewUserDialog } from './new-user-dialog';

const ROLES: Role[] = ['REQUESTER', 'AGENT', 'ADMIN'];

export function UsersPage() {
  useDocumentTitle('Usuários');
  const { user: me } = useAuth();
  const users = useUsers();
  const updateUser = useUpdateUser();

  function change(user: User, changes: UserChanges, message: string) {
    updateUser.mutate(
      { id: user.id, changes },
      {
        onSuccess: () => {
          toast.success(message);
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
          <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted-foreground">Quem pode entrar no DeskFlow, e com qual perfil.</p>
        </div>
        <NewUserDialog />
      </div>

      {users.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Carregando usuários">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : users.isError ? (
        <ErrorState message={getErrorMessage(users.error)} onRetry={() => void users.refetch()} />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="hidden md:table-cell">Desde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((user) => {
                // A API não deixa o admin tirar o próprio acesso (SELF_LOCKOUT); a tela nem oferece.
                const isMe = user.id === me?.id;
                return (
                  <TableRow key={user.id} className={user.isActive ? undefined : 'text-muted-foreground'}>
                    <TableCell>
                      <p className="font-medium">
                        {user.name}
                        {isMe && <span className="ml-1 text-xs font-normal text-muted-foreground">(você)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        disabled={isMe || updateUser.isPending}
                        onValueChange={(role) =>
                          change(
                            user,
                            { role: role as Role },
                            // A API encerra as sessões da pessoa: o novo perfil vale no próximo login.
                            `${user.name} agora é ${ROLE_LABELS[role as Role]}. Sessões abertas terminam em até 15 minutos.`,
                          )
                        }
                      >
                        <SelectTrigger className="w-36" aria-label={`Perfil de ${user.name}`}>
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
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={user.isActive}
                        disabled={isMe || updateUser.isPending}
                        aria-label={`${user.name} ativo`}
                        onCheckedChange={(isActive) =>
                          change(
                            user,
                            { isActive },
                            isActive
                              ? `${user.name} foi reativado.`
                              : `${user.name} foi desativado. Sessões abertas terminam em até 15 minutos.`,
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{formatDateTime(user.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
