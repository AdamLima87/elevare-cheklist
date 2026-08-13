-- Fase A do módulo comercial — configuração de tenant sobre o que exige pra
-- fechar uma oportunidade como "Ganha". A tabela nasce aqui e a UI mostra o
-- valor, mas crm_fechar_oportunidade_ganha só passa a LER esta coluna de
-- verdade na Fase E (quando Proposta e Contrato existirem de fato) — até lá,
-- essa configuração existe mas não tem nenhum efeito no fechamento.
--
-- Só 2 valores por decisão explícita: nenhum tenant pode desligar totalmente
-- a exigência de proposta/contrato depois que o módulo estiver completo.
CREATE TABLE public.crm_comercial_config (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id),
  ganha_exige text NOT NULL DEFAULT 'proposta_aceita'
    CHECK (ganha_exige IN ('proposta_aceita', 'contrato_assinado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_crm_comercial_config_updated_at
  BEFORE UPDATE ON public.crm_comercial_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT SELECT, UPDATE ON public.crm_comercial_config TO authenticated;
GRANT ALL ON public.crm_comercial_config TO service_role;
ALTER TABLE public.crm_comercial_config ENABLE ROW LEVEL SECURITY;

-- Diferente de crm_leads_config (que é só-RPC porque protege uma cota):
-- isto é uma configuração de tela normal, então admin lê E edita
-- diretamente. Consultor só lê.
CREATE POLICY crm_comercial_config_select ON public.crm_comercial_config
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );
CREATE POLICY crm_comercial_config_update ON public.crm_comercial_config
  FOR UPDATE USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil = 'admin'))
  );

-- Backfill pra tenants já existentes em staging/produção — sem isso, só
-- tenants provisionados depois desta migration teriam a linha (via o seed
-- abaixo), e o resto ficaria sem config até tocar em Configurações
-- Comerciais (mesma lição já registrada em 20260812170000).
INSERT INTO public.crm_comercial_config (empresa_id)
SELECT id FROM public.empresas
ON CONFLICT (empresa_id) DO NOTHING;

-- Extensão do seed padrão — corpo idêntico ao de 20260812170000, só
-- acrescentando o INSERT em crm_comercial_config pra tenants novos.
CREATE OR REPLACE FUNCTION public.crm_seed_catalogos_padrao(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_pipeline_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.crm_pipelines WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_pipelines (empresa_id, nome, padrao)
      VALUES (p_empresa_id, 'Pipeline Padrão', true)
      RETURNING id INTO v_pipeline_id;

    INSERT INTO public.crm_etapas (empresa_id, pipeline_id, nome, ordem, tipo, eh_proposta) VALUES
      (p_empresa_id, v_pipeline_id, 'Novo Lead', 1, 'aberta', false),
      (p_empresa_id, v_pipeline_id, 'Qualificação', 2, 'aberta', false),
      (p_empresa_id, v_pipeline_id, 'Proposta Enviada', 3, 'aberta', true),
      (p_empresa_id, v_pipeline_id, 'Negociação', 4, 'aberta', false),
      (p_empresa_id, v_pipeline_id, 'Ganho', 5, 'ganho', false),
      (p_empresa_id, v_pipeline_id, 'Perdido', 6, 'perdido', false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_motivos_perda WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_motivos_perda (empresa_id, nome, ordem) VALUES
      (p_empresa_id, 'Preço', 1),
      (p_empresa_id, 'Concorrência', 2),
      (p_empresa_id, 'Sem orçamento', 3),
      (p_empresa_id, 'Não respondeu', 4),
      (p_empresa_id, 'Projeto cancelado', 5),
      (p_empresa_id, 'Decisão interna', 6),
      (p_empresa_id, 'Outro', 7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_tipos_atividade WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_tipos_atividade (empresa_id, nome, ordem) VALUES
      (p_empresa_id, 'Ligação', 1),
      (p_empresa_id, 'WhatsApp', 2),
      (p_empresa_id, 'Email', 3),
      (p_empresa_id, 'Reunião', 4),
      (p_empresa_id, 'Visita', 5),
      (p_empresa_id, 'Videochamada', 6),
      (p_empresa_id, 'Tarefa', 7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_origens_lead WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_origens_lead (empresa_id, nome, peso_score, ordem) VALUES
      (p_empresa_id, 'Indicação', 20, 1),
      (p_empresa_id, 'Site', 10, 2),
      (p_empresa_id, 'Redes Sociais', 10, 3),
      (p_empresa_id, 'Evento', 15, 4),
      (p_empresa_id, 'Prospecção Ativa', 5, 5),
      (p_empresa_id, 'Outro', 0, 6),
      (p_empresa_id, 'Google Maps', 5, 7);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_leads_config WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_leads_config (empresa_id) VALUES (p_empresa_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_leads_nichos WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_leads_nichos (empresa_id, nome, ordem) VALUES
      (p_empresa_id, 'Restaurante', 1),
      (p_empresa_id, 'Padaria', 2),
      (p_empresa_id, 'Confeitaria', 3),
      (p_empresa_id, 'Pizzaria', 4),
      (p_empresa_id, 'Lanchonete', 5),
      (p_empresa_id, 'Hamburgueria', 6),
      (p_empresa_id, 'Café', 7),
      (p_empresa_id, 'Açougue', 8),
      (p_empresa_id, 'Mercado', 9),
      (p_empresa_id, 'Supermercado', 10),
      (p_empresa_id, 'Hotel', 11),
      (p_empresa_id, 'Hospital', 12),
      (p_empresa_id, 'Clínica', 13),
      (p_empresa_id, 'Escola', 14),
      (p_empresa_id, 'Creche', 15),
      (p_empresa_id, 'Cozinha Industrial', 16),
      (p_empresa_id, 'Indústria de Alimentos', 17),
      (p_empresa_id, 'Sorveteria', 18);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_comercial_config WHERE empresa_id = p_empresa_id) THEN
    INSERT INTO public.crm_comercial_config (empresa_id) VALUES (p_empresa_id);
  END IF;
END;
$function$;
