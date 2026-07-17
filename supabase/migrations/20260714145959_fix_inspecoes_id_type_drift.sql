-- Corrige um drift descoberto ao replicar o schema em um projeto de staging:
-- em produção, inspecoes.id é uuid (com default gen_random_uuid()), mas o
-- histórico de migrations versionado até este ponto ainda criava a coluna
-- como text — a correção real foi aplicada em produção manualmente em algum
-- momento, sem virar migration. Esta migration só formaliza esse estado no
-- histórico (idempotente: não faz nada se já estiver correto, como já é o
-- caso em produção).
DO $$
BEGIN
  IF (
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inspecoes' AND column_name = 'id'
  ) = 'text' THEN
    ALTER TABLE public.inspecoes ALTER COLUMN id TYPE uuid USING id::uuid;
    ALTER TABLE public.inspecoes ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END $$;
