-- =====================================================================
-- Cria o usuário da API na RDS (deskflow_app), com permissões mínimas:
-- ler e gravar dados, e nada mais. Não cria, altera nem apaga tabelas.
--
-- Rode UMA vez, conectado como deskflow_admin, DEPOIS das migrations.
-- A senha vem da variável de ambiente APP_DB_PASSWORD, nunca deste arquivo.
-- =====================================================================

\set ON_ERROR_STOP on

-- Lê a senha do ambiente para a variável "app_password" do psql.
\getenv app_password APP_DB_PASSWORD
\if :{?app_password}
\else
  DO $$ BEGIN RAISE EXCEPTION 'A variável APP_DB_PASSWORD não chegou ao psql.'; END $$;
\endif

BEGIN;

-- 1) O usuário: pode fazer login, e só.
CREATE ROLE deskflow_app LOGIN PASSWORD :'app_password';

-- 2) Pode conectar neste banco e usar o schema public (mas não criar nada nele).
GRANT CONNECT ON DATABASE deskflow TO deskflow_app;
GRANT USAGE ON SCHEMA public TO deskflow_app;

-- 3) Ler e gravar dados nas tabelas que já existem...
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO deskflow_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO deskflow_app;

-- 4) ...e nas que as próximas migrations criarem.
ALTER DEFAULT PRIVILEGES FOR ROLE deskflow_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO deskflow_app;
ALTER DEFAULT PRIVILEGES FOR ROLE deskflow_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO deskflow_app;

-- 5) O histórico de migrations é assunto só do administrador.
REVOKE ALL ON TABLE _prisma_migrations FROM deskflow_app;

-- 6) O histórico dos chamados só cresce: a API grava e lê eventos, nunca altera nem apaga.
--    (Apagar um chamado continua levando o histórico junto, pelo ON DELETE CASCADE.)
REVOKE UPDATE, DELETE ON TABLE ticket_events FROM deskflow_app;

COMMIT;

\echo 'Usuário deskflow_app criado com permissões mínimas.'
