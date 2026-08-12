-- Mesa de Trabalho, card "Propostas aguardando resposta": até aqui
-- detectava a etapa de proposta por substring no nome ("proposta" no
-- nome.toLowerCase()) -- frágil, quebra se o tenant renomear a etapa
-- (ex. "Orçamento enviado"). Substitui por um flag estruturado, mesmo
-- padrão já usado para `gera_diagnostico`.
--
-- Sem CHECK de unicidade por pipeline (ao contrário de gera_diagnostico):
-- nada impede, em tese, mais de uma etapa representar "proposta enviada"
-- num funil com etapas mais granulares -- não é um caso que precise ser
-- impedido.
ALTER TABLE public.crm_etapas ADD COLUMN eh_proposta boolean NOT NULL DEFAULT false;

-- Backfill: migra o comportamento atual (substring no nome) pro flag
-- estruturado, pra não mudar silenciosamente o que já aparecia no card
-- pros tenants existentes.
UPDATE public.crm_etapas SET eh_proposta = true WHERE lower(nome) LIKE '%proposta%';
