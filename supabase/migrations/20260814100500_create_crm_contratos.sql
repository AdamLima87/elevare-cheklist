-- Fase B — Contratos. Imutável a partir de 'gerado': dados/conteúdo
-- congelados pra sempre a partir dessa transição, nenhuma RPC subsequente
-- os altera. Mudar conteúdo exige cancelar + gerar de novo. Contratos
-- sucessivos pra mesma proposta são permitidos (histórico), mas nunca dois
-- não-cancelados simultâneos — índice único parcial, não UNIQUE simples.
CREATE TABLE public.crm_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  crm_oportunidade_id uuid NOT NULL,
  crm_proposta_id uuid NOT NULL,
  crm_empresa_id uuid NOT NULL,
  crm_contrato_template_id uuid NOT NULL,

  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'gerado', 'enviado', 'assinado', 'cancelado')),

  dados jsonb,

  gerado_em timestamptz,
  enviado_em timestamptz,
  assinado_em timestamptz,
  assinado_por uuid,
  arquivo_assinado_path text,
  justificativa_sem_arquivo text,
  origem_assinatura text NOT NULL DEFAULT 'upload_manual'
    CHECK (origem_assinatura IN ('upload_manual', 'assinatura_eletronica')),

  cancelado_em timestamptz,
  cancelado_motivo text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_contratos_oportunidade_fkey
    FOREIGN KEY (crm_oportunidade_id, empresa_id) REFERENCES public.crm_oportunidades (id, empresa_id),
  CONSTRAINT crm_contratos_proposta_fkey
    FOREIGN KEY (crm_proposta_id, empresa_id) REFERENCES public.crm_propostas (id, empresa_id),
  CONSTRAINT crm_contratos_crm_empresa_fkey
    FOREIGN KEY (crm_empresa_id, empresa_id) REFERENCES public.crm_empresas (id, empresa_id),
  CONSTRAINT crm_contratos_template_fkey
    FOREIGN KEY (crm_contrato_template_id, empresa_id) REFERENCES public.crm_contrato_templates (id, empresa_id),
  CONSTRAINT crm_contratos_assinado_por_fkey
    FOREIGN KEY (assinado_por, empresa_id) REFERENCES public.profiles (id, empresa_id),

  -- Defesa em profundidade, redundante com a validação na RPC de assinatura:
  -- nunca marcar assinado sem arquivo E sem justificativa.
  CONSTRAINT crm_contratos_assinatura_evidencia_check
    CHECK (status <> 'assinado' OR arquivo_assinado_path IS NOT NULL OR justificativa_sem_arquivo IS NOT NULL)
);
ALTER TABLE public.crm_contratos ADD CONSTRAINT crm_contratos_id_empresa_unique UNIQUE (id, empresa_id);

-- Nunca dois contratos simultaneamente "vivos" (não-cancelados) pra mesma
-- proposta — mas permite múltiplos contratos históricos (cancelado -> novo).
CREATE UNIQUE INDEX crm_contratos_proposta_ativo_idx
  ON public.crm_contratos (crm_proposta_id) WHERE status <> 'cancelado';

CREATE INDEX crm_contratos_oportunidade_idx ON public.crm_contratos (crm_oportunidade_id);

CREATE TRIGGER update_crm_contratos_updated_at
  BEFORE UPDATE ON public.crm_contratos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT ON public.crm_contratos TO authenticated;
GRANT ALL ON public.crm_contratos TO service_role;
ALTER TABLE public.crm_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_contratos_select ON public.crm_contratos
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );

-- Helper de renderização de template: substitui {{chave}} pelo valor
-- correspondente em p_variaveis (map jsonb texto->texto), seção por seção.
-- Usado tanto na geração do snapshot de contrato quanto na validação de
-- variável desconhecida.
CREATE OR REPLACE FUNCTION public.crm_renderizar_contrato_template(p_conteudo jsonb, p_variaveis jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_secoes jsonb := '[]'::jsonb;
  v_secao jsonb;
  v_corpo text;
  v_key text;
  v_val text;
BEGIN
  FOR v_secao IN SELECT * FROM jsonb_array_elements(p_conteudo) LOOP
    v_corpo := coalesce(v_secao->>'corpo', '');
    FOR v_key, v_val IN SELECT key, value FROM jsonb_each_text(p_variaveis) LOOP
      v_corpo := replace(v_corpo, '{{' || v_key || '}}', coalesce(v_val, ''));
    END LOOP;
    v_secoes := v_secoes || jsonb_build_array(jsonb_build_object('titulo', v_secao->>'titulo', 'corpo', v_corpo));
  END LOOP;
  RETURN v_secoes;
END;
$function$;
