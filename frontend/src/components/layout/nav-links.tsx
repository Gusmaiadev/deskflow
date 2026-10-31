import { LayoutDashboard, Tags, Ticket, Users, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { useAuth } from '@/auth/auth-context';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/api';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[]; // sem "roles": todos os perfis veem
};

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['AGENT', 'ADMIN'] },
  { to: '/tickets', label: 'Chamados', icon: Ticket },
  { to: '/users', label: 'Usuários', icon: Users, roles: ['ADMIN'] },
  { to: '/categories', label: 'Categorias', icon: Tags, roles: ['ADMIN'] },
];

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="Menu principal">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
            )
          }
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
