-- ═══════════════════════════════════════════════════════════════════
--  VENDEDORES  ·  Exclusão de cadastro (exclusão "suave")
--  Mercadão dos Óculos
--
--  O QUE FAZ
--  ---------
--  Adiciona a marcação "excluido" ao cadastro de usuários. Excluir um
--  vendedor NÃO apaga a linha dele nem o histórico: apenas o remove da
--  lista e o impede de aparecer em novos lançamentos. Assim, tudo que
--  ele lançou (vendas, captações) continua visível para o admin, com o
--  nome preservado.
--
--  POR QUE NÃO APAGAR DE VERDADE?
--  -----------------------------
--  As vendas e captações apontam para o cadastro do vendedor. Apagar a
--  linha quebraria esse vínculo e o nome sumiria do histórico — o oposto
--  do que se quer.
--
--  É SEGURO?
--  ---------
--  • NÃO apaga dados. Só adiciona uma coluna.
--  • Idempotente (pode rodar de novo sem problema).
--
--  COMO EXECUTAR
--  ------------
--  Supabase → SQL Editor → New query → cole tudo → RUN.
-- ═══════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists excluido boolean not null default false;

-- Verificação
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'excluido';
