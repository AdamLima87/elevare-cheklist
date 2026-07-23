-- Fase 2 (Diagnóstico no CRM) — flag independente em crm_etapas, não um novo
-- valor de `tipo` (diagnóstico não é um tipo de fechamento como ganho/perdido).
-- DEFAULT false cobre todas as etapas existentes automaticamente: nenhum
-- tenant, pipeline ou etapa muda de comportamento com esta migration. Nenhuma
-- etapa "Diagnóstico" é criada aqui — o rollout é opt-in, na Fase 5.
ALTER TABLE public.crm_etapas
  ADD COLUMN gera_diagnostico boolean NOT NULL DEFAULT false;
