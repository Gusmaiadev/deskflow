const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const relativeFormat = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

/** "14/10/2026, 18:30" */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
];

/** "em 3 horas", "há 2 dias", "agora" */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diff = new Date(iso).getTime() - now.getTime();

  for (const { unit, ms } of UNITS) {
    if (Math.abs(diff) >= ms) {
      return relativeFormat.format(Math.round(diff / ms), unit);
    }
  }

  return 'agora';
}

/** Iniciais para o avatar: "Marina Costa" → "MC" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}
