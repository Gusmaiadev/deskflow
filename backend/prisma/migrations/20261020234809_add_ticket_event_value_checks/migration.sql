-- from_value e to_value servem aos três campos do histórico, por isso são texto, sem enum e sem FK.
-- Estas regras devolvem ao banco a conferência do formato: cada valor precisa combinar com o campo.

-- Status: um valor do enum ticket_status (enum_range acompanha valores novos do enum)
ALTER TABLE "ticket_events"
  ADD CONSTRAINT "ticket_events_status_values_chk"
  CHECK ("field" <> 'STATUS' OR (
    "from_value" = ANY (enum_range(NULL::"ticket_status")::text[]) AND
    "to_value" = ANY (enum_range(NULL::"ticket_status")::text[])
  ));

-- Prioridade: um valor do enum ticket_priority
ALTER TABLE "ticket_events"
  ADD CONSTRAINT "ticket_events_priority_values_chk"
  CHECK ("field" <> 'PRIORITY' OR (
    "from_value" = ANY (enum_range(NULL::"ticket_priority")::text[]) AND
    "to_value" = ANY (enum_range(NULL::"ticket_priority")::text[])
  ));

-- Responsável: o id do usuário (uuid em minúsculas, como o banco devolve), ou nulo (sem responsável)
ALTER TABLE "ticket_events"
  ADD CONSTRAINT "ticket_events_assignee_values_chk"
  CHECK ("field" <> 'ASSIGNEE' OR (
    ("from_value" IS NULL OR "from_value" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') AND
    ("to_value" IS NULL OR "to_value" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ));
