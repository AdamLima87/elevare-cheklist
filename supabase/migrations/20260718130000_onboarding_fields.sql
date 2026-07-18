-- Campos necessários pro wizard de onboarding do cadastro público.

ALTER TABLE public.empresas ADD COLUMN onboarding_completed_at timestamptz;

-- Backfill obrigatório, na mesma migration que cria a coluna: toda empresa
-- que já existe antes desta entrega nasce marcada como "onboarding já
-- feito". Só empresas criadas depois (via provision_tenant, que deixa o
-- campo NULL de propósito) caem no wizard — nenhum admin atual é forçado
-- a passar por ele.
UPDATE public.empresas SET onboarding_completed_at = now() WHERE onboarding_completed_at IS NULL;

ALTER TABLE public.configuracoes ADD COLUMN logo_base64 text;

-- Dados profissionais do responsável técnico (etapa 3 do onboarding).
ALTER TABLE public.profiles ADD COLUMN conselho_regional text;
ALTER TABLE public.profiles ADD COLUMN numero_registro text;
