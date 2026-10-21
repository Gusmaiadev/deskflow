-- Trigramas: pedaços de 3 caracteres seguidos (letras ou números) do texto. Com eles, um índice GIN
-- atende o ILIKE '%texto%' da busca, que um índice B-tree comum não consegue usar (Dia 2).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- A busca procura no título OU na descrição. Com OR, o PostgreSQL só usa índice se todos os lados
-- tiverem um: só com o índice do título, ele continuaria lendo a tabela inteira.
-- Limites: termos com menos de 3 caracteres não formam trigramas, e, para termos que aparecem numa
-- parte grande dos chamados, o PostgreSQL pode preferir ler a tabela. Custo: os índices ocupam espaço
-- e deixam cada gravação de chamado um pouco mais lenta.

-- CreateIndex
CREATE INDEX "tickets_title_trgm_idx" ON "tickets" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "tickets_description_trgm_idx" ON "tickets" USING GIN ("description" gin_trgm_ops);
