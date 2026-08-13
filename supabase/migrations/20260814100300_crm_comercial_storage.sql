-- Fase B — bucket privado de anexos comerciais. Infraestrutura genuinamente
-- nova (zero uso de Storage no projeto até aqui), então a RLS de
-- storage.objects merece o mesmo cuidado das RLS de tabela: isolamento
-- estrito por prefixo de tenant, testado cross-tenant explicitamente.
--
-- Estrutura de path (subpastas fixas por decisão do usuário):
--   {empresa_id}/propostas/{proposta_id}/evidencias/...   (evidência de aceite)
--   {empresa_id}/contratos/{contrato_id}/assinados/...    (arquivo assinado)
--
-- storage.foldername(name) devolve os segmentos do path como array — o
-- primeiro segmento ((storage.foldername(name))[1]) é sempre o empresa_id,
-- comparado contra get_minha_empresa().
INSERT INTO storage.buckets (id, name, public)
VALUES ('crm-comercial-anexos', 'crm-comercial-anexos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY crm_comercial_anexos_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'crm-comercial-anexos'
    AND (
      public.is_super_admin()
      OR (
        (storage.foldername(name))[1] = public.get_minha_empresa()::text
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor'))
      )
    )
  );

CREATE POLICY crm_comercial_anexos_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'crm-comercial-anexos'
    AND (
      public.is_super_admin()
      OR (
        (storage.foldername(name))[1] = public.get_minha_empresa()::text
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor'))
      )
    )
  );

CREATE POLICY crm_comercial_anexos_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'crm-comercial-anexos'
    AND (
      public.is_super_admin()
      OR (
        (storage.foldername(name))[1] = public.get_minha_empresa()::text
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor'))
      )
    )
  );

CREATE POLICY crm_comercial_anexos_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'crm-comercial-anexos'
    AND (
      public.is_super_admin()
      OR (
        (storage.foldername(name))[1] = public.get_minha_empresa()::text
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND perfil IN ('admin', 'consultor'))
      )
    )
  );
