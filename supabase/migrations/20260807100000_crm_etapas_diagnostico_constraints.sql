-- Fase 5 (Diagnóstico configurável no CRM) — duas garantias estruturais em
-- crm_etapas, independentes de RPC e de UI:
--
-- 1) no máximo uma etapa marcada como gera_diagnostico=true por PIPELINE
--    (não por tenant/empresa — um tenant pode ter múltiplos pipelines).
-- 2) uma etapa gera_diagnostico=true só pode ser tipo='aberta' — nunca
--    'ganho'/'perdido'. Sem essa CHECK, um upsert direto de `tipo` (feito
--    pela UI de CRUD de etapas, que edita nome/cor/tipo/ordem fora da RPC
--    de configuração) poderia deixar uma etapa de fechamento marcada como
--    Diagnóstico. A UI desabilita essa opção, mas a garantia real é esta
--    constraint — se o UPDATE ainda assim tentar, falha com 23514 e o
--    frontend traduz isso pedindo pra remover a marcação primeiro.
--
-- Pré-validado por scripts/prevalidacao-etapa-diagnostico.mjs — hoje
-- gera_diagnostico é sempre false (Fase 2), então ambas as checagens devem
-- retornar zero violações.

CREATE UNIQUE INDEX IF NOT EXISTS crm_etapas_pipeline_diagnostico_unique
  ON public.crm_etapas (pipeline_id)
  WHERE gera_diagnostico = true;

ALTER TABLE public.crm_etapas
  ADD CONSTRAINT crm_etapas_diagnostico_somente_aberta_check
  CHECK (gera_diagnostico = false OR tipo = 'aberta');
