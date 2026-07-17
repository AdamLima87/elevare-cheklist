-- Fecha uma vulnerabilidade de isolamento pré-existente: a policy de INSERT
-- em profiles hoje só checa `id = auth.uid()`, sem validar empresa_id — um
-- usuário autenticado poderia, via client, se auto-inserir num profile
-- apontando para QUALQUER empresa cujo UUID conseguisse adivinhar.
--
-- Confirmado por grep no código: nenhum fluxo do app faz insert direto em
-- profiles hoje — toda criação passa pela edge function admin-manage-users
-- (service_role, que ignora GRANT/RLS). Fechar esta porta não quebra nada
-- existente.
--
-- REVOKE explícito, não só remover a policy: uma policy permissiva futura
-- se combinaria por OR com qualquer outra que reste, reabrindo a porta.
-- Sem o GRANT de INSERT, isso é impossível independente de policies.
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
REVOKE INSERT ON public.profiles FROM authenticated, anon;
