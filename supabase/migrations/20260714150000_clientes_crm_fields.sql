-- Fase 5.1: campos de funil de CRM em clientes (prospeccao -> ativo)
ALTER TABLE public.clientes ADD COLUMN status TEXT NOT NULL DEFAULT 'ativo'
  CHECK (status IN ('prospeccao', 'ativo', 'inativo'));
ALTER TABLE public.clientes ADD COLUMN etapa_funil TEXT;
ALTER TABLE public.clientes ADD COLUMN origem TEXT;
ALTER TABLE public.clientes ADD COLUMN responsavel_id UUID REFERENCES public.profiles(id);
