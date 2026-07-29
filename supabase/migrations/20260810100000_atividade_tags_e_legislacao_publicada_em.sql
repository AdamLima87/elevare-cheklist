-- Fase 9.C — catálogo global de atividades para o motor de recomendação de
-- legislação (Fase 9.D) e data oficial de publicação das versões de
-- legislação. Nenhuma coluna nova em `clientes` — UF/atividades são
-- capturadas por inspeção, nunca persistidas como verdade única no cliente
-- (ver Fase 9.A/9.B no plano técnico: nada garante 1 unidade física por
-- cliente).

CREATE TABLE public.atividade_tags (
  codigo text PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.atividade_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY atividade_tags_select ON public.atividade_tags
  FOR SELECT TO authenticated USING (true);
CREATE POLICY atividade_tags_admin ON public.atividade_tags
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 11 códigos aprovados (Fase 9.B) — catálogo fechado e versionável; novos
-- códigos só entram via migration, nunca em runtime.
INSERT INTO public.atividade_tags (codigo, nome) VALUES
  ('servico_alimentacao', 'Serviço de alimentação'),
  ('comercio_alimentos', 'Comércio de alimentos (varejo/atacado/depósito)'),
  ('comercio_atacadista', 'Comércio atacadista de alimentos'),
  ('venda_a_granel', 'Venda de produtos de origem vegetal a granel'),
  ('culinaria_japonesa', 'Culinária japonesa (sushi e preparações similares)'),
  ('alimentos_crus_mal_cozidos', 'Oferece alimentos crus ou mal cozidos'),
  ('manipula_perecivel_origem_animal', 'Manipula perecíveis de origem animal'),
  ('transporta_alimentos', 'Transporta alimentos'),
  ('realiza_delivery', 'Realiza entrega de alimentos em domicílio (delivery)'),
  ('servico_alimentacao_coletiva', 'Serviço de alimentação coletiva (cozinha industrial, self-service, buffê, escola, presídio, hospital etc.)'),
  ('producao_industrializacao', 'Produção ou industrialização de alimentos');

-- Data oficial de publicação (DOE), separada de created_at (data do seed no
-- banco) e nunca guardada só em texto livre em `descricao`.
ALTER TABLE public.legislacao_versoes ADD COLUMN publicada_em date;
