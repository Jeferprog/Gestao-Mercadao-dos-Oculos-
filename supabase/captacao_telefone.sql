-- ═══════════════════════════════════════════════════════════════════
--  CAPTAÇÃO · Telefone do cliente
--  Mercadão dos Óculos
--
--  Só ADICIONA a coluna "telefone" (opcional). Não altera nem apaga
--  nenhum registro. Seguro/idempotente.
--  Supabase → SQL Editor → New query → cole tudo → RUN.
-- ═══════════════════════════════════════════════════════════════════

alter table public.captacao_clientes
  add column if not exists telefone text;
