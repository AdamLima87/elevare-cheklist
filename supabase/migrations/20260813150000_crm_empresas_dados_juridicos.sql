-- Fase A do módulo comercial (Proposta/Contrato) — dados jurídicos da Conta,
-- necessários pra gerar um contrato no futuro (Fase D), mas nada aqui é
-- obrigatório na criação/edição normal de uma Conta (lead/oportunidade
-- continuam funcionando sem nenhum destes campos preenchidos). A validação
-- de completude só acontece na hora de gerar um contrato de verdade.
--
-- razao_social já existe (é PJ por natureza semântica) — nome_completo_pf é
-- o campo novo pra quando tipo_pessoa='fisica', porque razao_social não
-- serve pra nomear uma pessoa física contratante.
ALTER TABLE public.crm_empresas
  ADD COLUMN tipo_pessoa text CHECK (tipo_pessoa IN ('juridica', 'fisica')),
  ADD COLUMN cpf text,
  ADD COLUMN nome_completo_pf text,
  ADD COLUMN cep text,
  ADD COLUMN endereco text,
  ADD COLUMN numero text,
  ADD COLUMN complemento text,
  ADD COLUMN bairro text,
  -- Separados de cidade/estado (já existentes, usados pra qualificação de
  -- lead) porque o endereço contratual pode divergir — sede numa cidade,
  -- unidade contratada em outra, já que numero_unidades pode ser > 1.
  ADD COLUMN cidade_endereco text,
  ADD COLUMN uf_endereco text;

-- Normaliza CPF pra dígitos antes de gravar, mesmo padrão de
-- crm_normalizar_cnpj (20260720100200_create_crm_empresas.sql).
CREATE OR REPLACE FUNCTION public.crm_normalizar_cpf()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cpf IS NOT NULL THEN
    NEW.cpf := NULLIF(regexp_replace(NEW.cpf, '\D', '', 'g'), '');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_empresas_normalizar_cpf
  BEFORE INSERT OR UPDATE ON public.crm_empresas
  FOR EACH ROW EXECUTE FUNCTION public.crm_normalizar_cpf();
