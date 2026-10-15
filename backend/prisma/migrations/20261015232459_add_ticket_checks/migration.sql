-- O prazo do chamado precisa ser depois da abertura
ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_due_after_created_chk" CHECK ("due_at" > "created_at");
