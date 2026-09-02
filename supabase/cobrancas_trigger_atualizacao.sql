-- ═══════════════════════════════════════════════════════════════════
--  COBRANÇAS  ·  Atualização automática da data do devedor (à prova de falhas)
--  Mercadão dos Óculos
--
--  O QUE FAZ
--  ---------
--  Garante, no próprio banco de dados, que o campo "ultima_atualizacao"
--  do devedor receba a data de hoje SEMPRE que houver qualquer registro
--  nele — boleto, lembrete ou documento — criado, alterado ou excluído.
--  Funciona independente da tela/botão usado no sistema.
--
--  É SEGURO?  Sim — só cria uma função e gatilhos. Não apaga dados.
--  Idempotente. Supabase → SQL Editor → New query → cole tudo → RUN.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.bump_devedor_atualizacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dev uuid;
begin
  dev := coalesce(new.devedor_id, old.devedor_id);
  if dev is not null then
    update public.cobrancas_devedores
      set ultima_atualizacao = current_date
      where id = dev;
  end if;
  return coalesce(new, old);
end $$;

-- Boletos
drop trigger if exists trg_bump_boletos on public.cobrancas_boletos;
create trigger trg_bump_boletos
  after insert or update or delete on public.cobrancas_boletos
  for each row execute function public.bump_devedor_atualizacao();

-- Lembretes
drop trigger if exists trg_bump_lembretes on public.cobrancas_lembretes;
create trigger trg_bump_lembretes
  after insert or update or delete on public.cobrancas_lembretes
  for each row execute function public.bump_devedor_atualizacao();

-- Documentos (envolvido em bloco: a tabela pode não existir em todos os ambientes)
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='cobrancas_documentos') then
    execute 'drop trigger if exists trg_bump_documentos on public.cobrancas_documentos';
    execute 'create trigger trg_bump_documentos
             after insert or update or delete on public.cobrancas_documentos
             for each row execute function public.bump_devedor_atualizacao()';
  end if;
end $$;
