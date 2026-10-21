-- CreateEnum
CREATE TYPE "ticket_event_field" AS ENUM ('STATUS', 'PRIORITY', 'ASSIGNEE');

-- CreateTable
CREATE TABLE "ticket_events" (
    "id" UUID NOT NULL,
    "field" "ticket_event_field" NOT NULL,
    "from_value" VARCHAR(40),
    "to_value" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ticket_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,

    CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_events_ticket_id_created_at_idx" ON "ticket_events"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "ticket_events_actor_id_idx" ON "ticket_events"("actor_id");

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Um evento registra uma mudança de verdade: o valor novo é diferente do anterior
ALTER TABLE "ticket_events"
  ADD CONSTRAINT "ticket_events_value_changed_chk" CHECK ("from_value" IS DISTINCT FROM "to_value");

-- Status e prioridade sempre têm valor; só o responsável pode ficar vazio (chamado sem responsável)
ALTER TABLE "ticket_events"
  ADD CONSTRAINT "ticket_events_values_present_chk"
  CHECK ("field" = 'ASSIGNEE' OR ("from_value" IS NOT NULL AND "to_value" IS NOT NULL));
