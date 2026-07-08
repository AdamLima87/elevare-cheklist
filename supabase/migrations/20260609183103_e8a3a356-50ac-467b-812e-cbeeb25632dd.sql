-- 1. Identify and fix duplicates
-- We'll keep the most recent record with the duplicate number and re-assign others
DO $$
DECLARE
    r RECORD;
    next_num INT;
BEGIN
    -- Get current max number
    SELECT COALESCE(MAX(numero), 0) INTO next_num FROM public.inspecoes;
    
    -- Loop through duplicates
    FOR r IN (
        SELECT id 
        FROM (
            SELECT id, 
                   ROW_NUMBER() OVER(PARTITION BY numero ORDER BY data_inicio DESC) as rn
            FROM public.inspecoes
        ) t
        WHERE rn > 1
    ) LOOP
        next_num := next_num + 1;
        UPDATE public.inspecoes SET numero = next_num WHERE id = r.id;
    END LOOP;
    
    -- Update the tracking table to the new max
    UPDATE public.numeracao_inspecoes 
    SET ultimo_numero = (SELECT COALESCE(MAX(numero), 0) FROM public.inspecoes),
        numeros_disponiveis = '{}'
    WHERE id = 1;
END $$;

-- 2. Add unique constraint
ALTER TABLE public.inspecoes ADD CONSTRAINT unique_inspecao_numero UNIQUE (numero);
