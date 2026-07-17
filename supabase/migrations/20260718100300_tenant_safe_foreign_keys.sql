-- FKs de cliente_id hoje referenciam só clientes(id), não (id, empresa_id):
-- nada no banco impede uma linha de inspecoes/documentos/visitas/
-- cliente_interacoes da Empresa A apontar para um cliente da Empresa B.

-- Passo 1 — checagem, não correção silenciosa. Aborta se houver qualquer
-- inconsistência já existente; não tenta "corrigir" dados automaticamente.
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count FROM (
    SELECT i.id FROM public.inspecoes i JOIN public.clientes c ON c.id = i.cliente_id
      WHERE i.empresa_id IS DISTINCT FROM c.empresa_id
    UNION ALL
    SELECT d.id FROM public.documentos d JOIN public.clientes c ON c.id = d.cliente_id
      WHERE d.empresa_id IS DISTINCT FROM c.empresa_id
    UNION ALL
    SELECT v.id FROM public.visitas v JOIN public.clientes c ON c.id = v.cliente_id
      WHERE v.empresa_id IS DISTINCT FROM c.empresa_id
    UNION ALL
    SELECT ci.id FROM public.cliente_interacoes ci JOIN public.clientes c ON c.id = ci.cliente_id
      WHERE ci.empresa_id IS DISTINCT FROM c.empresa_id
  ) inconsistencias;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'Encontradas % linhas com cliente_id/empresa_id inconsistentes — resolva manualmente antes de aplicar as FKs compostas', v_count;
  END IF;
END $$;

-- Passo 2 — só roda se o passo 1 não abortou.
ALTER TABLE public.clientes ADD CONSTRAINT clientes_id_empresa_unique UNIQUE (id, empresa_id);

ALTER TABLE public.inspecoes DROP CONSTRAINT inspecoes_cliente_id_fkey;
ALTER TABLE public.inspecoes ADD CONSTRAINT inspecoes_cliente_id_empresa_fkey
  FOREIGN KEY (cliente_id, empresa_id) REFERENCES public.clientes(id, empresa_id);

ALTER TABLE public.documentos DROP CONSTRAINT documentos_cliente_id_fkey;
ALTER TABLE public.documentos ADD CONSTRAINT documentos_cliente_id_empresa_fkey
  FOREIGN KEY (cliente_id, empresa_id) REFERENCES public.clientes(id, empresa_id);

ALTER TABLE public.visitas DROP CONSTRAINT visitas_cliente_id_fkey;
ALTER TABLE public.visitas ADD CONSTRAINT visitas_cliente_id_empresa_fkey
  FOREIGN KEY (cliente_id, empresa_id) REFERENCES public.clientes(id, empresa_id);

ALTER TABLE public.cliente_interacoes DROP CONSTRAINT cliente_interacoes_cliente_id_fkey;
ALTER TABLE public.cliente_interacoes ADD CONSTRAINT cliente_interacoes_cliente_id_empresa_fkey
  FOREIGN KEY (cliente_id, empresa_id) REFERENCES public.clientes(id, empresa_id);

-- Índices compostos — hoje só existem PKs (confirmado via pg_indexes), toda
-- query filtrada por tenant faz table scan.
CREATE INDEX IF NOT EXISTS inspecoes_empresa_cliente_idx ON public.inspecoes (empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS inspecoes_empresa_status_idx ON public.inspecoes (empresa_id, status);
CREATE INDEX IF NOT EXISTS documentos_empresa_created_idx ON public.documentos (empresa_id, created_at);
CREATE INDEX IF NOT EXISTS visitas_empresa_created_idx ON public.visitas (empresa_id, created_at);
