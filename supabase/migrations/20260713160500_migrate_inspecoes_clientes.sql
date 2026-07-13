-- Fase 2.6: migrar pares unicos estabelecimento_nome+cnpj de inspecoes para clientes,
-- popular inspecoes.cliente_id

ALTER TABLE public.inspecoes ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id);

INSERT INTO public.clientes (empresa_id, nome, cnpj)
SELECT DISTINCT ON (i.cnpj, i.estabelecimento_nome)
    i.empresa_id,
    i.estabelecimento_nome,
    i.cnpj
FROM public.inspecoes i
WHERE i.estabelecimento_nome IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.empresa_id = i.empresa_id
        AND c.nome = i.estabelecimento_nome
        AND (c.cnpj IS NOT DISTINCT FROM i.cnpj)
  );

UPDATE public.inspecoes i
SET cliente_id = c.id
FROM public.clientes c
WHERE i.cliente_id IS NULL
  AND c.empresa_id = i.empresa_id
  AND c.nome = i.estabelecimento_nome
  AND (c.cnpj IS NOT DISTINCT FROM i.cnpj);
