import { FilterX, ListFilter, Search } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import type { TicketFilters } from '@/api/tickets';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type { Category, User } from '@/types/api';
import { SORT_OPTIONS } from './ticket-filters';

/** Mudanças na URL: valor undefined apaga o parâmetro. */
export type FilterChanges = Record<string, string | undefined>;

// O Select do Radix não aceita valor vazio, então "todos" usa um valor-sentinela.
const ALL = 'all';

/** Campo de busca que só atualiza a URL 400 ms depois que a pessoa para de digitar. */
function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);

  // Se a URL mudar por fora (ex.: "Limpar filtros"), o campo acompanha.
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  // useEffectEvent: lê sempre o onChange mais recente sem reiniciar o temporizador
  // a cada nova renderização da tela.
  const commit = useEffectEvent((next: string) => onChange(next));

  useEffect(() => {
    if (text.trim() === value) return;
    const timer = setTimeout(() => commit(text.trim()), 400);
    return () => clearTimeout(timer);
  }, [text, value]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        placeholder="Buscar por título ou #número"
        aria-label="Buscar chamados"
        className="pl-8"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  );
}

type FilterSelectProps = {
  label: string;
  value: string | undefined;
  options: { value: string; label: string }[];
  allLabel: string;
  onChange: (value: string | undefined) => void;
};

function FilterSelect({ label, value, options, allLabel, onChange }: FilterSelectProps) {
  return (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? undefined : next)}>
      <SelectTrigger className="w-full sm:w-48" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type TicketsToolbarProps = {
  filters: TicketFilters;
  activeCount: number;
  isStaff: boolean;
  categories: Category[];
  staff: User[];
  onChange: (changes: FilterChanges, options?: { replace?: boolean }) => void;
  onClear: () => void;
};

export function TicketsToolbar({
  filters,
  activeCount,
  isStaff,
  categories,
  staff,
  onChange,
  onClear,
}: TicketsToolbarProps) {
  // No celular, os filtros ficam recolhidos atrás de um botão para não ocupar a tela toda.
  const [showFilters, setShowFilters] = useState(false);

  const assigneeOptions = [
    { value: 'me', label: 'Atribuídos a mim' },
    { value: 'none', label: 'Sem responsável' },
    ...staff.map((person) => ({ value: person.id, label: person.name })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={filters.q ?? ''} onChange={(q) => onChange({ q: q || undefined }, { replace: true })} />
        <Select value={filters.sort} onValueChange={(sort) => onChange({ sort })}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Ordenar por">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        className="sm:hidden"
        aria-expanded={showFilters}
        onClick={() => setShowFilters((open) => !open)}
      >
        <ListFilter aria-hidden="true" />
        Filtros{activeCount > 0 && ` (${activeCount})`}
      </Button>

      <div
        className={cn(
          'flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center',
          showFilters ? 'flex' : 'hidden',
        )}
      >
        <FilterSelect
          label="Status"
          value={filters.status}
          options={STATUS_OPTIONS}
          allLabel="Todos os status"
          onChange={(status) => onChange({ status })}
        />
        <FilterSelect
          label="Prioridade"
          value={filters.priority}
          options={PRIORITY_OPTIONS}
          allLabel="Todas as prioridades"
          onChange={(priority) => onChange({ priority })}
        />
        <FilterSelect
          label="Categoria"
          value={filters.categoryId}
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
          allLabel="Todas as categorias"
          onChange={(categoryId) => onChange({ categoryId })}
        />
        {isStaff && (
          <FilterSelect
            label="Responsável"
            value={filters.assignee}
            options={assigneeOptions}
            allLabel="Qualquer responsável"
            onChange={(assignee) => onChange({ assignee })}
          />
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id="overdue"
            checked={filters.overdue === true}
            onCheckedChange={(checked) => onChange({ overdue: checked === true ? 'true' : undefined })}
          />
          <Label htmlFor="overdue" className="font-normal">
            Somente atrasados
          </Label>
        </div>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="sm:ml-auto">
            <FilterX aria-hidden="true" />
            Limpar filtros ({activeCount})
          </Button>
        )}
      </div>
    </div>
  );
}
