import { CircleCheckBig, Inbox, TriangleAlert, UserX, type LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { useDashboard } from '@/api/dashboard';
import { ErrorState } from '@/components/feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/errors';
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { useDocumentTitle } from '@/lib/use-document-title';
import type { Dashboard, TicketPriority, TicketStatus } from '@/types/api';

// As mesmas cores dos selos (Dia 6), em tons mais fortes para as barras.
// Valores da paleta padrão do Tailwind 4, escritos aqui porque o gráfico (SVG) recebe a cor pronta.
const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: 'oklch(68.5% 0.169 237.323)', // sky-500
  IN_PROGRESS: 'oklch(76.9% 0.188 70.08)', // amber-500
  WAITING_REQUESTER: 'oklch(60.6% 0.25 292.717)', // violet-500
  RESOLVED: 'oklch(69.6% 0.17 162.48)', // emerald-500
  CLOSED: 'oklch(70.5% 0.015 286.067)', // zinc-400
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  LOW: 'oklch(70.5% 0.015 286.067)', // zinc-400
  MEDIUM: 'oklch(62.3% 0.214 259.815)', // blue-500
  HIGH: 'oklch(70.5% 0.213 47.604)', // orange-500
  URGENT: 'oklch(63.7% 0.237 25.331)', // red-500
};

// Rótulos curtos: o eixo do gráfico não comporta "Aguardando solicitante".
const SHORT_STATUS: Record<TicketStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Andamento',
  WAITING_REQUESTER: 'Aguardando',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
};

const chartConfig = {
  total: { label: 'Chamados', color: 'var(--chart-2)' },
} satisfies ChartConfig;

function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  danger = false,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  hint: string;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardDescription>{title}</CardDescription>
        <Icon className={cn('size-4 text-muted-foreground', danger && value > 0 && 'text-destructive')} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <p className={cn('text-3xl font-semibold tabular-nums', danger && value > 0 && 'text-destructive')}>{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/** Gráfico de barras simples: uma barra por item, cada uma com a sua cor. */
function BarsChart({ data, label }: { data: { key: string; label: string; total: number; color: string }[]; label: string }) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full" aria-label={label}>
      <BarChart data={data} margin={{ left: -16 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} fontSize={12} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="total" radius={4}>
          {data.map((item) => (
            <Cell key={item.key} fill={item.color} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function DashboardContent({ dashboard }: { dashboard: Dashboard }) {
  const { summary, sla } = dashboard;

  const statusData = STATUS_OPTIONS.map(({ value }) => ({
    key: value,
    label: SHORT_STATUS[value],
    total: dashboard.byStatus[value],
    color: STATUS_COLORS[value],
  }));

  const priorityData = PRIORITY_OPTIONS.map(({ value, label }) => ({
    key: value,
    label,
    total: dashboard.openByPriority[value],
    color: PRIORITY_COLORS[value],
  }));

  // "2026-10-14" → "14/10"
  const perDayData = dashboard.createdPerDay.map(({ date, total }) => ({
    key: date,
    label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
    total,
    color: 'var(--color-total)',
  }));

  const maxCategory = Math.max(1, ...dashboard.openByCategory.map((item) => item.total));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Abertos" value={summary.open} icon={Inbox} hint="Aguardando solução" />
        <StatCard title="Atrasados" value={summary.overdue} icon={TriangleAlert} hint="Prazo do SLA vencido" danger />
        <StatCard title="Sem responsável" value={summary.unassigned} icon={UserX} hint="Ninguém assumiu ainda" />
        <StatCard
          title="Resolvidos"
          value={summary.resolvedLast30Days}
          icon={CircleCheckBig}
          hint={`Nos últimos ${sla.periodDays} dias`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SLA nos últimos {sla.periodDays} dias</CardTitle>
          <CardDescription>Chamados resolvidos dentro do prazo da prioridade</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-3xl font-semibold tabular-nums">
              {sla.compliancePercent === null ? '—' : `${sla.compliancePercent}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {sla.withinSla} de {sla.resolved} resolvidos no prazo
            </p>
          </div>
          <div>
            <p className="text-3xl font-semibold tabular-nums">
              {sla.averageResolutionHours === null ? '—' : `${sla.averageResolutionHours} h`}
            </p>
            <p className="text-xs text-muted-foreground">Tempo médio até a resolução</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Chamados por status</CardTitle>
            <CardDescription>Todos os chamados</CardDescription>
          </CardHeader>
          <CardContent>
            <BarsChart data={statusData} label="Gráfico de chamados por status" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Abertos por prioridade</CardTitle>
            <CardDescription>Ainda não resolvidos</CardDescription>
          </CardHeader>
          <CardContent>
            <BarsChart data={priorityData} label="Gráfico de chamados abertos por prioridade" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Novos chamados por dia</CardTitle>
            <CardDescription>Últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <BarsChart data={perDayData} label="Gráfico de chamados abertos por dia" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Abertos por categoria</CardTitle>
            <CardDescription>Onde está a demanda</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.openByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum chamado aberto.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {dashboard.openByCategory.map((item) => (
                  <li key={item.category} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span>{item.category}</span>
                      <span className="font-medium tabular-nums">{item.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${(item.total / maxCategory) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const dashboard = useDashboard();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {dashboard.data
            ? `Atualizado às ${new Date(dashboard.data.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Atualiza sozinho a cada minuto.`
            : 'Os números da central de suporte.'}
        </p>
      </div>

      {dashboard.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Carregando indicadores">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : dashboard.isError ? (
        <ErrorState message={getErrorMessage(dashboard.error)} onRetry={() => void dashboard.refetch()} />
      ) : (
        <DashboardContent dashboard={dashboard.data} />
      )}
    </div>
  );
}
