-- CRM Comercial — Timeline (histórico obrigatório de cada Conta/Oportunidade,
-- "nada invisível"). Append-only por design: authenticated só tem GRANT de
-- SELECT/INSERT, nunca UPDATE/DELETE — mesmo espírito do audit_log.
--
-- origem = 'usuario': só pode ser inserida pelo próprio usuário autenticado,
-- com autor_id = auth.uid() (política abaixo). origem = 'sistema': só entra
-- via trigger/RPC SECURITY DEFINER (mudança de etapa, fechamento de
-- oportunidade etc.) — não existe policy de INSERT liberando 'sistema' pra
-- authenticated, então o app nunca consegue forjar um evento de sistema.
CREATE TABLE public.crm_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),

  crm_empresa_id uuid NOT NULL,
  crm_oportunidade_id uuid,

  origem text NOT NULL DEFAULT 'usuario' CHECK (origem IN ('sistema', 'usuario')),
  evento_tipo text NOT NULL,
  descricao text NOT NULL,
  autor_id uuid, -- NULL para eventos 100% de sistema
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_timeline_crm_empresa_fkey
    FOREIGN KEY (crm_empresa_id, empresa_id) REFERENCES public.crm_empresas (id, empresa_id),
  CONSTRAINT crm_timeline_crm_oportunidade_fkey
    FOREIGN KEY (crm_oportunidade_id, empresa_id) REFERENCES public.crm_oportunidades (id, empresa_id),
  CONSTRAINT crm_timeline_autor_fkey
    FOREIGN KEY (autor_id, empresa_id) REFERENCES public.profiles (id, empresa_id)
);

CREATE INDEX crm_timeline_crm_empresa_idx ON public.crm_timeline (crm_empresa_id, created_at DESC);
CREATE INDEX crm_timeline_crm_oportunidade_idx ON public.crm_timeline (crm_oportunidade_id, created_at DESC);

-- Sem UPDATE/DELETE: nem admin apaga/edita timeline pelo client.
GRANT SELECT, INSERT ON public.crm_timeline TO authenticated;
GRANT ALL ON public.crm_timeline TO service_role;
ALTER TABLE public.crm_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY crm_timeline_select ON public.crm_timeline
  FOR SELECT USING (
    public.is_super_admin()
    OR (empresa_id = public.get_minha_empresa()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor')))
  );

-- Usuário só pode inserir evento de origem 'usuario', com autor_id = si
-- mesmo. Eventos 'sistema' não têm policy de INSERT para authenticated —
-- só entram via função SECURITY DEFINER (trigger de mudança de etapa etc.),
-- que roda como owner da tabela e bypassa RLS.
CREATE POLICY crm_timeline_insert_usuario ON public.crm_timeline
  FOR INSERT WITH CHECK (
    origem = 'usuario'
    AND autor_id = auth.uid()
    AND empresa_id = public.get_minha_empresa()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor'))
  );
