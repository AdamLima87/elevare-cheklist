-- Pré-requisito para o CRM Comercial: toda referência a usuário
-- (responsavel_id, autor_id etc.) nas tabelas novas crm_* precisa ser uma
-- FK composta (fk_id, empresa_id) -> profiles(id, empresa_id), no mesmo
-- espírito das FKs tenant-safe já usadas para clientes/inspecoes/etc.
-- (20260718100300_tenant_safe_foreign_keys.sql). Isso impede, por
-- construção no banco, que uma oportunidade/atividade de um tenant seja
-- atribuída a um usuário de outro tenant — não depende só de RLS.
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_empresa_unique UNIQUE (id, empresa_id);
