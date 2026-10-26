import { LifeBuoy, Menu } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useNavigation } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { NavLinks } from './nav-links';
import { UserMenu } from './user-menu';

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold">
      <LifeBuoy className="size-5 text-primary" aria-hidden="true" />
      DeskFlow
    </Link>
  );
}

/** Estrutura das telas logadas: menu lateral (ou gaveta no celular), cabeçalho e conteúdo. */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  // "loading" enquanto o código de uma página carregada sob demanda está chegando.
  const navigation = useNavigation();

  return (
    <div className="flex min-h-svh">
      {navigation.state === 'loading' && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-primary" role="progressbar" aria-label="Carregando página" />
      )}
      {/* Menu lateral fixo: só em telas médias para cima (md:) */}
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar md:flex md:flex-col">
        <div className="flex h-14 items-center border-b px-4">
          <Brand />
        </div>
        <NavLinks />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          {/* No celular, o menu vira uma gaveta que abre pela esquerda */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="border-b">
                <SheetTitle>DeskFlow</SheetTitle>
                <SheetDescription className="sr-only">Navegação principal</SheetDescription>
              </SheetHeader>
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="md:hidden">
            <Brand />
          </div>
          <div className="flex-1" />
          <UserMenu />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
