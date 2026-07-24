-- Fase 7.1 — fundação da estrutura de legislações/versionamento de checklist.
-- Catálogo GLOBAL (compartilhado entre todos os tenants): RDC 275/2002, RDC
-- 216/2004, CVS 3/2026-SP e futuras normas não pertencem a uma empresa
-- específica. Só super_admin escreve; qualquer usuário autenticado lê.
-- Personalização por tenant fica fora desta fase (só documentada como
-- extensão futura no plano — não há tabela alguma para isso aqui).

CREATE TABLE public.legislacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  esfera text NOT NULL CHECK (esfera IN ('federal', 'estadual')),
  uf text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- uf só é preenchido para esfera='estadual' — não é NOT NULL porque leis
-- federais nunca têm uf, e uma CHECK exigindo isso seria só uma restrição a
-- mais sem benefício real (nenhum código depende de uf ser sempre coerente
-- com esfera nesta fase; a regra de aplicabilidade real fica pra Fase 9).

CREATE TABLE public.legislacao_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legislacao_id uuid NOT NULL REFERENCES public.legislacoes(id),
  numero_versao integer NOT NULL,
  descricao text,
  vigente_desde date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (legislacao_id, numero_versao)
);

CREATE TABLE public.checklist_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legislacao_versao_id uuid NOT NULL REFERENCES public.legislacao_versoes(id),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_modelo_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id uuid NOT NULL REFERENCES public.checklist_modelos(id),
  numero_versao integer NOT NULL,
  is_versao_atual boolean NOT NULL DEFAULT false,
  publicado_em timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modelo_id, numero_versao)
);

-- No máximo 1 versão "atual" POR MODELO — não um default global único. Cada
-- modelo (RDC 275 hoje; RDC 216/CVS 3 nas Fases 8/9) tem a sua própria versão
-- atual, independente das outras. Qual modelo se aplica a um diagnóstico é
-- decisão de resolver_checklist_modelo_padrao() (migration seguinte), não
-- desta flag.
CREATE UNIQUE INDEX checklist_modelo_versoes_atual_por_modelo
  ON public.checklist_modelo_versoes (modelo_id)
  WHERE is_versao_atual = true;

CREATE TABLE public.checklist_secoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_versao_id uuid NOT NULL REFERENCES public.checklist_modelo_versoes(id),
  secao_key text NOT NULL,
  titulo text NOT NULL,
  ordem integer NOT NULL,
  UNIQUE (modelo_versao_id, secao_key)
);

CREATE TABLE public.checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_versao_id uuid NOT NULL REFERENCES public.checklist_modelo_versoes(id),
  secao_id uuid NOT NULL REFERENCES public.checklist_secoes(id),
  item_key text NOT NULL,
  texto text NOT NULL,
  critico boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL,
  UNIQUE (modelo_versao_id, item_key)
);

CREATE INDEX checklist_itens_secao_idx ON public.checklist_itens (secao_id);
CREATE INDEX legislacao_versoes_legislacao_idx ON public.legislacao_versoes (legislacao_id);
CREATE INDEX checklist_modelos_legislacao_versao_idx ON public.checklist_modelos (legislacao_versao_id);
CREATE INDEX checklist_modelo_versoes_modelo_idx ON public.checklist_modelo_versoes (modelo_id);

-- Imutabilidade de CONTEÚDO: uma vez a versão do modelo publicada, seções e
-- itens não podem mais ser alterados nem apagados — garantido no banco, não
-- só na aplicação (mesmo princípio já usado na Fase 5 para gera_diagnostico:
-- bloquear no banco é mais previsível que confiar em cada call site).
CREATE OR REPLACE FUNCTION public.checklist_bloquear_edicao_publicado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_publicado_em timestamptz;
  v_modelo_versao_id uuid;
BEGIN
  v_modelo_versao_id := COALESCE(OLD.modelo_versao_id, NEW.modelo_versao_id);
  SELECT publicado_em INTO v_publicado_em
    FROM public.checklist_modelo_versoes WHERE id = v_modelo_versao_id;
  IF v_publicado_em IS NOT NULL THEN
    RAISE EXCEPTION 'Versão de checklist já publicada em % — seções e itens são imutáveis.', v_publicado_em
      USING ERRCODE = '55000';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER checklist_secoes_bloquear_edicao_publicado
  BEFORE UPDATE OR DELETE ON public.checklist_secoes
  FOR EACH ROW EXECUTE FUNCTION public.checklist_bloquear_edicao_publicado();

CREATE TRIGGER checklist_itens_bloquear_edicao_publicado
  BEFORE UPDATE OR DELETE ON public.checklist_itens
  FOR EACH ROW EXECUTE FUNCTION public.checklist_bloquear_edicao_publicado();

-- Imutabilidade de IDENTIDADE: uma vez publicada, a versão não pode trocar de
-- modelo nem de número (mudar isso retroativamente equivaleria a reescrever
-- qual checklist uma inspeção histórica realmente usou). Colunas operacionais
-- (ativo, is_versao_atual) continuam livres para mudar.
CREATE OR REPLACE FUNCTION public.checklist_modelo_versao_bloquear_identidade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  IF OLD.publicado_em IS NOT NULL
     AND (NEW.modelo_id IS DISTINCT FROM OLD.modelo_id
          OR NEW.numero_versao IS DISTINCT FROM OLD.numero_versao) THEN
    RAISE EXCEPTION 'Versão de checklist já publicada — modelo_id e numero_versao são imutáveis.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER checklist_modelo_versoes_bloquear_identidade
  BEFORE UPDATE ON public.checklist_modelo_versoes
  FOR EACH ROW EXECUTE FUNCTION public.checklist_modelo_versao_bloquear_identidade();

-- Um modelo com QUALQUER versão publicada não pode trocar de legislação —
-- mesma lógica de "identidade publicada é imutável", um nível acima.
CREATE OR REPLACE FUNCTION public.checklist_modelo_bloquear_identidade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  v_tem_versao_publicada boolean;
BEGIN
  IF NEW.legislacao_versao_id IS DISTINCT FROM OLD.legislacao_versao_id THEN
    SELECT EXISTS (
      SELECT 1 FROM public.checklist_modelo_versoes
      WHERE modelo_id = OLD.id AND publicado_em IS NOT NULL
    ) INTO v_tem_versao_publicada;
    IF v_tem_versao_publicada THEN
      RAISE EXCEPTION 'Modelo com versão publicada — legislacao_versao_id é imutável.'
        USING ERRCODE = '55000';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER checklist_modelos_bloquear_identidade
  BEFORE UPDATE ON public.checklist_modelos
  FOR EACH ROW EXECUTE FUNCTION public.checklist_modelo_bloquear_identidade();

-- Publicar é uma ação deliberada via RPC, não um UPDATE direto — grava em
-- audit_log (convenção do projeto: audit_log para ações administrativas de
-- plataforma, crm_timeline para eventos de negócio de uma oportunidade —
-- isto aqui é claramente administrativo/plataforma).
CREATE OR REPLACE FUNCTION public.publicar_checklist_modelo_versao(p_modelo_versao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Apenas super_admin pode publicar versões de checklist.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.checklist_modelo_versoes
    SET publicado_em = now()
    WHERE id = p_modelo_versao_id AND publicado_em IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Versão de checklist não encontrada ou já publicada.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_log (empresa_id, actor_id, event_type, metadata)
    VALUES (NULL, auth.uid(), 'checklist_modelo_versao_publicada',
            jsonb_build_object('modelo_versao_id', p_modelo_versao_id));
END;
$function$;

REVOKE ALL ON FUNCTION public.publicar_checklist_modelo_versao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publicar_checklist_modelo_versao(uuid) TO authenticated;

-- RLS — catálogo global: leitura pra qualquer usuário autenticado (não é
-- dado sensível nem por-tenant), escrita só super_admin.
ALTER TABLE public.legislacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legislacao_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_modelo_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_secoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY legislacoes_select ON public.legislacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY legislacoes_admin ON public.legislacoes
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY legislacao_versoes_select ON public.legislacao_versoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY legislacao_versoes_admin ON public.legislacao_versoes
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY checklist_modelos_select ON public.checklist_modelos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY checklist_modelos_admin ON public.checklist_modelos
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY checklist_modelo_versoes_select ON public.checklist_modelo_versoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY checklist_modelo_versoes_admin ON public.checklist_modelo_versoes
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY checklist_secoes_select ON public.checklist_secoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY checklist_secoes_admin ON public.checklist_secoes
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY checklist_itens_select ON public.checklist_itens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY checklist_itens_admin ON public.checklist_itens
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
