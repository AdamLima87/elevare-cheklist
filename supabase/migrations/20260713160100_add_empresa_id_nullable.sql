-- Fase 2.2: empresa_id nullable em profiles, inspecoes, configuracoes
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.inspecoes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.configuracoes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
