-- Fase 2.3: popular empresa_id de todas as linhas existentes com o id da Elevare
UPDATE public.profiles
SET empresa_id = (SELECT id FROM public.empresas WHERE nome = 'Elevare Consultoria')
WHERE empresa_id IS NULL;

UPDATE public.inspecoes
SET empresa_id = (SELECT id FROM public.empresas WHERE nome = 'Elevare Consultoria')
WHERE empresa_id IS NULL;

UPDATE public.configuracoes
SET empresa_id = (SELECT id FROM public.empresas WHERE nome = 'Elevare Consultoria')
WHERE empresa_id IS NULL;
