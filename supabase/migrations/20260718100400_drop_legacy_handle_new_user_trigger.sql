-- Drift encontrado ao replicar o schema em staging: um trigger
-- on_auth_user_created (função handle_new_user) tentava inserir
-- automaticamente uma linha em profiles a cada novo usuário no Auth, sem
-- empresa_id — incompatível com profiles.empresa_id NOT NULL (Fase 2,
-- multi-tenant) e já quebrado por isso. Confirmado que este trigger NÃO
-- existe em produção (nenhum trigger ativo em auth.users lá) — foi
-- removido manualmente em algum momento sem virar migration.
--
-- Esta remoção também é um pré-requisito real para o cadastro público:
-- toda criação de usuário no Auth (incluindo via admin.generateLink no
-- fluxo de signup) passaria por este trigger e tentaria inserir um profile
-- órfão de empresa antes que provision_tenant() tivesse a chance de criar
-- a linha correta — causando erro ou corrida entre os dois.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
