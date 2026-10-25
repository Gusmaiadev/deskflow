// Os formatos que a API do DeskFlow devolve. Datas chegam como texto (ISO 8601).

export type Role = 'ADMIN' | 'AGENT' | 'REQUESTER';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_REQUESTER' | 'RESOLVED' | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

/** Resposta do login e do refresh. O refresh token não aparece aqui: ele viaja num cookie httpOnly. */
export type Session = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
};

export type Category = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type PersonSummary = {
  id: string;
  name: string;
};

export type Ticket = {
  id: string;
  number: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  isOverdue: boolean;
  dueAt: string;
  /** Desde quando aguarda o solicitante; enquanto isso, o SLA fica pausado. */
  waitingSince: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string };
  requester: PersonSummary;
  assignee: PersonSummary | null;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** Envelope de sucesso: { data } */
export type ApiData<T> = { data: T };

/** Envelope de lista paginada: { data, meta } */
export type ApiPage<T> = { data: T[]; meta: PageMeta };

/** Envelope de erro: { error: { code, message, details } } */
export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};
