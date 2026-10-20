-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "waiting_since" TIMESTAMPTZ(3);

-- Chamados que já aguardam o solicitante: a pausa conta a partir da última alteração
UPDATE "tickets" SET "waiting_since" = "updated_at" WHERE "status" = 'WAITING_REQUESTER';

-- A pausa do SLA existe exatamente enquanto o chamado aguarda o solicitante
ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_waiting_since_chk" CHECK (("status" = 'WAITING_REQUESTER') = ("waiting_since" IS NOT NULL));
