-- Fase 2.4: tornar empresa_id NOT NULL nas tres tabelas
ALTER TABLE public.profiles ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.inspecoes ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.configuracoes ALTER COLUMN empresa_id SET NOT NULL;
