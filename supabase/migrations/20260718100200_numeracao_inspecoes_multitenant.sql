-- numeracao_inspecoes hoje é uma tabela singleton (1 linha, id=1) sem
-- empresa_id, lida/escrita via select-depois-update sem transação (race
-- condition mesmo dentro de uma única empresa) e compartilhada por todas as
-- empresas da plataforma — vaza volume de negócio entre concorrentes e
-- quebra sob concorrência entre empresas.

ALTER TABLE public.numeracao_inspecoes ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);

-- Backfill: associa a linha de contagem legada à empresa mais antiga
-- existente (hoje há exatamente 1 empresa em produção). O valor usado é o
-- maior entre o contador legado e o MAX(numero_sequencial) já usado por
-- ela, para nunca reemitir um número já consumido (mesmo que a inspeção
-- correspondente tenha sido apagada depois).
DO $$
DECLARE
  v_empresa_id uuid;
  v_max_legado int;
  v_max_inspecoes int;
BEGIN
  SELECT id INTO v_empresa_id FROM public.empresas ORDER BY created_at ASC LIMIT 1;
  IF v_empresa_id IS NULL THEN
    RETURN; -- nenhuma empresa ainda; nada a migrar
  END IF;

  SELECT ultimo_numero INTO v_max_legado FROM public.numeracao_inspecoes LIMIT 1;
  SELECT COALESCE(MAX(numero_sequencial), 0) INTO v_max_inspecoes
    FROM public.inspecoes WHERE empresa_id = v_empresa_id;

  UPDATE public.numeracao_inspecoes
    SET empresa_id = v_empresa_id,
        ultimo_numero = GREATEST(COALESCE(v_max_legado, 0), v_max_inspecoes)
    WHERE empresa_id IS NULL;

  -- Qualquer outra empresa com inspeções mas sem linha de numeração ainda
  -- (não deveria existir hoje, mas cobre o caso) ganha sua própria linha.
  INSERT INTO public.numeracao_inspecoes (empresa_id, ultimo_numero)
  SELECT i.empresa_id, MAX(i.numero_sequencial)
  FROM public.inspecoes i
  WHERE i.empresa_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.numeracao_inspecoes n WHERE n.empresa_id = i.empresa_id
    )
  GROUP BY i.empresa_id;
END $$;

ALTER TABLE public.numeracao_inspecoes DROP CONSTRAINT numeracao_inspecoes_pkey;
ALTER TABLE public.numeracao_inspecoes DROP COLUMN id;
ALTER TABLE public.numeracao_inspecoes DROP COLUMN numeros_disponiveis;
ALTER TABLE public.numeracao_inspecoes ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.numeracao_inspecoes ADD PRIMARY KEY (empresa_id);

-- Função atômica: NÃO recebe empresa_id do chamador — resolve via
-- get_minha_empresa() (já corrigida para exigir usuário ativo). O cliente
-- nunca informa a empresa; não há como pedir número para outra empresa.
-- INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING é atômico (lock de
-- linha implícito) e, como efeito colateral, cria a linha sob demanda na
-- primeira inspeção da empresa.
CREATE OR REPLACE FUNCTION public.get_next_numero_inspecao()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_empresa_id uuid;
  v_numero int;
BEGIN
  v_empresa_id := public.get_minha_empresa();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada ou inativo' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.numeracao_inspecoes (empresa_id, ultimo_numero)
    VALUES (v_empresa_id, 1)
  ON CONFLICT (empresa_id)
    DO UPDATE SET ultimo_numero = public.numeracao_inspecoes.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_numero;

  RETURN v_numero;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_next_numero_inspecao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_numero_inspecao() TO authenticated;

-- Drift encontrado em ambientes recriados do zero a partir do histórico de
-- migrations: uma constraint global UNIQUE(numero_sequencial) que NÃO
-- existe em produção (foi removida manualmente lá em algum momento, sem
-- virar migration), mas ainda existe nas migrations antigas versionadas.
-- Ela contradiz o design atual (empresas diferentes DEVEM poder ter o
-- mesmo número) — remove se existir, sem erro se não existir.
ALTER TABLE public.inspecoes DROP CONSTRAINT IF EXISTS unique_inspecao_numero;

-- Unicidade É POR EMPRESA — duas empresas diferentes podem (e vão,
-- naturalmente) ter o número 1 cada uma. Isso trava só duplicata dentro da
-- mesma empresa, mesmo que algum caminho futuro pule a função.
ALTER TABLE public.inspecoes
  ADD CONSTRAINT inspecoes_empresa_numero_unique UNIQUE (empresa_id, numero_sequencial);

-- RLS: defesa em profundidade além da função SECURITY DEFINER.
DROP POLICY IF EXISTS numeracao_auth ON public.numeracao_inspecoes;
DROP POLICY IF EXISTS "Admins and consultores can delete numeracao" ON public.numeracao_inspecoes;
DROP POLICY IF EXISTS "Admins and consultores can modify numeracao" ON public.numeracao_inspecoes;
DROP POLICY IF EXISTS "Authenticated can read numeracao" ON public.numeracao_inspecoes;
DROP POLICY IF EXISTS "Admins and consultores can update numeracao" ON public.numeracao_inspecoes;

CREATE POLICY numeracao_select ON public.numeracao_inspecoes
  FOR SELECT USING (empresa_id = public.get_minha_empresa() OR public.is_super_admin());
-- Sem policy de INSERT/UPDATE/DELETE para authenticated/anon: a única
-- escrita legítima é via get_next_numero_inspecao() (SECURITY DEFINER).
