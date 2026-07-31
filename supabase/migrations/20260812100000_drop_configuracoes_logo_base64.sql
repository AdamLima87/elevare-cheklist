-- logo_base64 foi criada no onboarding (Fase de cadastro público) prevendo
-- timbre por-tenant, mas o usuário decidiu manter só a logo do RDCheck em
-- todos os relatórios (consultoria/consultor aparecem como texto no
-- cabeçalho, não como logo própria — ver pdf.ts). Coluna nunca foi lida
-- nem escrita por nenhum código do frontend.
ALTER TABLE public.configuracoes DROP COLUMN logo_base64;
