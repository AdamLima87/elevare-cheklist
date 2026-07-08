-- Revoke execute on the function for safety
REVOKE EXECUTE ON FUNCTION public.handle_inspection_concluded_client_auth() FROM public;
REVOKE EXECUTE ON FUNCTION public.handle_inspection_concluded_client_auth() FROM authenticated;

-- Add search_path to the function
ALTER FUNCTION public.handle_inspection_concluded_client_auth() SET search_path = public;

-- Table to queue client user creation
CREATE TABLE IF NOT EXISTS public.client_user_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  nome TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

GRANT SELECT, INSERT, UPDATE ON public.client_user_queue TO authenticated;
GRANT ALL ON public.client_user_queue TO service_role;

ALTER TABLE public.client_user_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e consultores podem gerenciar fila" ON public.client_user_queue
FOR ALL TO authenticated
USING (
  (SELECT perfil FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'consultor')
);

-- Update the trigger function to use the queue
CREATE OR REPLACE FUNCTION public.handle_inspection_concluded_client_auth()
RETURNS TRIGGER AS $$
DECLARE
  clean_cnpj TEXT;
  legal_email TEXT;
  legal_name TEXT;
  existing_user_id UUID;
BEGIN
  IF NEW.status = 'concluida' AND (OLD.status IS NULL OR OLD.status <> 'concluida') THEN
    clean_cnpj := regexp_replace(NEW.cnpj, '\D', 'g');
    legal_email := NEW.dados->'estabelecimento'->>'respLegalEmail';
    IF legal_email IS NULL OR legal_email = '' THEN
       legal_email := NEW.dados->'estabelecimento'->>'email'; 
    END IF;
    legal_name := NEW.dados->'estabelecimento'->>'respLegalNome';

    IF legal_email IS NOT NULL AND legal_email <> '' THEN
      -- Queue for processing by Edge Function or manual intervention
      INSERT INTO public.client_user_queue (email, cnpj, nome)
      VALUES (legal_email, clean_cnpj, legal_name)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS tr_inspection_concluded_client_auth ON public.inspecoes;
CREATE TRIGGER tr_inspection_concluded_client_auth
AFTER UPDATE ON public.inspecoes
FOR EACH ROW
EXECUTE FUNCTION public.handle_inspection_concluded_client_auth();
