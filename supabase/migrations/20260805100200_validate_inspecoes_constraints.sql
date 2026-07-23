-- Fase 3 (Diagnóstico no CRM) — valida as duas constraints NOT VALID
-- (inspecoes_tem_origem_check da Fase 2, inspecoes_diagnostico_tem_oportunidade_check
-- desta fase), só aplicada depois que scripts/prevalidacao-diagnostico-crm.mjs
-- confirmou zero violações para as duas em staging.
-- VALIDATE CONSTRAINT sobre NOT VALID existente só pega SHARE UPDATE
-- EXCLUSIVE LOCK — não bloqueia leitura/escrita concorrente.
ALTER TABLE public.inspecoes VALIDATE CONSTRAINT inspecoes_tem_origem_check;
ALTER TABLE public.inspecoes VALIDATE CONSTRAINT inspecoes_diagnostico_tem_oportunidade_check;
