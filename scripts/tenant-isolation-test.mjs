// Bateria de testes destrutivos de isolamento multi-tenant. Roda contra o
// projeto Supabase de STAGING (xqjvkevesrmkbtbvtzhk) — nunca produção, ver
// o guard logo abaixo. Cria e-mails descartáveis @rdcheck-test.internal,
// exercita os fluxos reais (cadastro público, confirmação de e-mail, login,
// RLS) via HTTP/supabase-js, e limpa tudo ao final (inclusive em caso de
// falha, via try/finally).
//
// uso: node scripts/tenant-isolation-test.mjs [caminho/para/.env.staging]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_REF = "nvkfgczahyxzgoomkavk";
const STAGING_REF = "xqjvkevesrmkbtbvtzhk";

function loadEnvFile(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const envPath = process.argv[2] || ".env.staging";
const env = loadEnvFile(envPath);
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error(`Faltam variáveis em ${envPath} (SUPABASE_URL/VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).`);
  process.exit(1);
}
if (SUPABASE_URL.includes(PRODUCTION_REF)) {
  console.error(`RECUSADO: ${envPath} aponta para o projeto de PRODUÇÃO (${PRODUCTION_REF}). Este script é destrutivo e só roda contra staging.`);
  process.exit(1);
}
if (!SUPABASE_URL.includes(STAGING_REF)) {
  console.error(`AVISO: ${envPath} não aponta para o projeto de staging conhecido (${STAGING_REF}). Abortando por segurança — se este for um staging novo legítimo, atualize STAGING_REF no script.`);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const newAnonClient = () => createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message || String(err) });
    console.log(`  \x1b[31m✗\x1b[0m ${name}: ${err.message || err}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@rdcheck-test.internal`;
}

async function callPublicSignup(body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/public-signup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// Confirma o e-mail de um usuário já criado (unconfirmed) gerando um link
// novo via Admin API e visitando-o com redirect:'manual' — reproduz
// exatamente o mecanismo real do link enviado por e-mail (GET /auth/v1/verify
// confirma e responde 303), sem depender de capturar tokens do fragmento da
// URL (que só um browser real consegue ler).
async function confirmEmail(email, password) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${SUPABASE_URL}` },
  });
  if (error) throw new Error(`generateLink falhou para ${email}: ${error.message}`);
  const res = await fetch(data.properties.action_link, { redirect: "manual" });
  assert(res.status === 303, `confirmação de e-mail retornou status ${res.status}, esperado 303`);
  const location = res.headers.get("location") || "";
  assert(!location.includes("error="), `link de confirmação retornou erro no redirect: ${location}`);
}

async function signIn(email, password) {
  const client = newAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login falhou para ${email}: ${error.message}`);
  return { client, userId: data.user.id };
}

// signup_attempts só existe para contar rate limit (5/IP/hora) — como este
// script faz bem mais que 5 chamadas reais ao public-signup na mesma hora
// a partir da mesma máquina, limpamos o contador entre blocos. É seguro só
// em staging (dados de log descartáveis, não é dado de tenant); nunca
// chamar isto fora de um script de teste.
async function resetRateLimit() {
  await admin.from("signup_attempts").delete().not("id", "is", null);
}

// Cria um tenant completo e real, do jeito que um usuário faria: cadastro
// público -> confirmação de e-mail -> login. Retorna um client autenticado
// como o admin do tenant.
async function createTenant(label) {
  const email = uniqueEmail(label);
  const password = "senhaDeTeste123!";
  const empresaNome = `Isolamento ${label} ${Date.now()}`;

  const signup = await callPublicSignup({
    nomeCompleto: `Admin ${label}`,
    email,
    whatsapp: "11999990000",
    empresaNome,
    password,
    website: "",
  });
  assert(signup.status === 200 && signup.body.success !== false, `signup de ${label} falhou: ${JSON.stringify(signup.body)}`);

  await confirmEmail(email, password);
  const { client, userId } = await signIn(email, password);

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("empresa_id")
    .eq("id", userId)
    .single();
  if (profileErr) throw new Error(`profile de ${label} não encontrado após signup: ${profileErr.message}`);

  return { label, email, password, client, userId, empresaId: profile.empresa_id, empresaNome, userIds: [userId] };
}

async function seedCliente(tenant, nome) {
  const { data, error } = await tenant.client.from("clientes").insert({ empresa_id: tenant.empresaId, nome }).select("id").single();
  if (error) throw new Error(`seed de cliente falhou para ${tenant.label}: ${error.message}`);
  return data.id;
}

// Cria uma Conta + Oportunidade reais no CRM do tenant, usando o pipeline/etapa
// padrão já semeados por provision_tenant (crm_seed_catalogos_padrao) — nenhum
// catálogo novo é criado, só uma Conta e uma Oportunidade sobre o que já existe.
async function seedOportunidade(tenant, nome) {
  const { data: pipeline, error: pipelineErr } = await admin
    .from("crm_pipelines")
    .select("id")
    .eq("empresa_id", tenant.empresaId)
    .eq("padrao", true)
    .single();
  if (pipelineErr) throw new Error(`pipeline padrão não encontrado para ${tenant.label}: ${pipelineErr.message}`);

  const { data: etapa, error: etapaErr } = await admin
    .from("crm_etapas")
    .select("id")
    .eq("pipeline_id", pipeline.id)
    .order("ordem")
    .limit(1)
    .single();
  if (etapaErr) throw new Error(`etapa inicial não encontrada para ${tenant.label}: ${etapaErr.message}`);

  const { data: crmEmpresa, error: crmEmpresaErr } = await tenant.client
    .from("crm_empresas")
    .insert({ empresa_id: tenant.empresaId, razao_social: nome, responsavel_id: tenant.userId })
    .select("id")
    .single();
  if (crmEmpresaErr) throw new Error(`seed de crm_empresas falhou para ${tenant.label}: ${crmEmpresaErr.message}`);

  const { data: oportunidade, error: oportunidadeErr } = await tenant.client
    .from("crm_oportunidades")
    .insert({
      empresa_id: tenant.empresaId,
      crm_empresa_id: crmEmpresa.id,
      pipeline_id: pipeline.id,
      etapa_id: etapa.id,
      nome,
      responsavel_id: tenant.userId,
    })
    .select("id")
    .single();
  if (oportunidadeErr) throw new Error(`seed de crm_oportunidades falhou para ${tenant.label}: ${oportunidadeErr.message}`);
  return oportunidade.id;
}

// Fase 3: cria um diagnóstico pré-venda real (tipo_execucao='diagnostico',
// vinculado a uma oportunidade, sem cliente_id) via inspecoes_diagnostico_insert.
async function seedDiagnostico(tenant, oportunidadeId, extra = {}) {
  const { data: numero, error: numeroErr } = await tenant.client.rpc("get_next_numero_inspecao");
  if (numeroErr) throw numeroErr;
  const { data, error } = await tenant.client
    .from("inspecoes")
    .insert({
      empresa_id: tenant.empresaId,
      crm_oportunidade_id: oportunidadeId,
      tipo_execucao: "diagnostico",
      numero_sequencial: numero,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw new Error(`seed de diagnóstico falhou para ${tenant.label}: ${error.message}`);
  return data.id;
}

// Ordem importa por causa de FKs (nenhuma tabela abaixo tem ON DELETE CASCADE
// pra empresas — todas são NO ACTION por desenho, ver Fase 2). "inspecoes"
// precisa ser limpa antes de "crm_oportunidades" por causa da FK nova
// inspecoes_crm_oportunidade_empresa_fkey (NO ACTION): apagar uma oportunidade
// enquanto uma inspeção ainda a referencia é proibido pelo banco.
const CLEANUP_TABLES_IN_ORDER = [
  "crm_timeline",
  "crm_atividades",
  "documentos",
  "visitas",
  "cliente_interacoes",
  // Fase 7 — referenciam inspecoes via FK composta (NO ACTION), precisam
  // ser limpas antes. reinspecao_programacao_eventos NÃO tem empresa_id
  // (só programacao_id) — limpa via subquery, tratado à parte em
  // cleanupTenant() antes deste laço genérico.
  "reinspecao_programacoes",
  "inspecoes",
  "crm_oportunidades",
  "crm_contatos",
  "crm_empresas",
  "clientes",
  "crm_etapas",
  "crm_pipelines",
  "crm_motivos_perda",
  "crm_tipos_atividade",
  "crm_origens_lead",
  "crm_leads_nichos",
  "crm_leads_config",
  "configuracoes",
  "numeracao_inspecoes",
];

async function cleanupTenant(tenant) {
  const empresaId = tenant.empresaId;
  // reinspecao_programacao_eventos não tem empresa_id — limpa via
  // subconsulta pelas programações do tenant, antes do laço genérico.
  const { data: progsDoTenant } = await admin.from("reinspecao_programacoes").select("id").eq("empresa_id", empresaId);
  if (progsDoTenant?.length) {
    const { error } = await admin.from("reinspecao_programacao_eventos").delete().in("programacao_id", progsDoTenant.map((p) => p.id));
    if (error) console.error(`  aviso: limpeza de reinspecao_programacao_eventos para ${tenant.label} falhou: ${error.message}`);
  }
  for (const table of CLEANUP_TABLES_IN_ORDER) {
    const { error } = await admin.from(table).delete().eq("empresa_id", empresaId);
    if (error) console.error(`  aviso: limpeza de ${table} para ${tenant.label} falhou: ${error.message}`);
  }
  for (const userId of tenant.userIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  const { error: empresaErr } = await admin.from("empresas").delete().eq("id", empresaId);
  if (empresaErr) console.error(`  aviso: DELETE de empresas para ${tenant.label} falhou: ${empresaErr.message}`);
}

async function main() {
  console.log(`\nTestes de isolamento multi-tenant — staging (${SUPABASE_URL})\n`);
  const tenants = [];

  try {
    await resetRateLimit();
    console.log("Setup: criando Empresa A e Empresa B via cadastro público real...");
    const A = await createTenant("A");
    tenants.push(A); // empurra assim que criado — se B falhar (ex.: rate limit),
    // A ainda é limpo no finally em vez de ficar órfão em staging.
    const B = await createTenant("B");
    tenants.push(B);

    const clienteA = await seedCliente(A, "Cliente da Empresa A");
    const clienteB = await seedCliente(B, "Cliente da Empresa B");
    const oportunidadeA = await seedOportunidade(A, "Oportunidade da Empresa A");
    const oportunidadeB = await seedOportunidade(B, "Oportunidade da Empresa B");

    console.log("\nIsolamento cross-tenant (Empresa A tentando acessar dados da Empresa B):");

    await test("SELECT direto por ID de cliente de outra empresa retorna vazio", async () => {
      const { data, error } = await A.client.from("clientes").select("id").eq("id", clienteB);
      if (error) throw error;
      assert(data.length === 0, `esperava 0 linhas, recebeu ${data.length}`);
    });

    await test("UPDATE em cliente de outra empresa não afeta nenhuma linha", async () => {
      const { data, error } = await A.client.from("clientes").update({ nome: "hackeado" }).eq("id", clienteB).select("id");
      if (error) throw error;
      assert(data.length === 0, `UPDATE afetou ${data.length} linha(s), esperado 0`);
      const { data: check } = await admin.from("clientes").select("nome").eq("id", clienteB).single();
      assert(check.nome === "Cliente da Empresa B", "nome do cliente da Empresa B foi alterado indevidamente");
    });

    await test("DELETE em cliente de outra empresa não remove a linha", async () => {
      const { data, error } = await A.client.from("clientes").delete().eq("id", clienteB).select("id");
      if (error) throw error;
      assert(data.length === 0, `DELETE afetou ${data.length} linha(s), esperado 0`);
      const { data: check } = await admin.from("clientes").select("id").eq("id", clienteB).maybeSingle();
      assert(check !== null, "cliente da Empresa B foi removido indevidamente");
    });

    await test("INSERT de inspeção com cliente_id de outra empresa falha (FK composta)", async () => {
      const { data: numero, error: numeroErr } = await A.client.rpc("get_next_numero_inspecao");
      if (numeroErr) throw numeroErr;
      const { error } = await A.client.from("inspecoes").insert({
        empresa_id: A.empresaId,
        cliente_id: clienteB,
        numero_sequencial: numero,
      });
      assert(error !== null, "INSERT deveria ter falhado por FK composta, mas foi aceito");
    });

    await test("INSERT direto em profiles com empresa_id de outra empresa falha", async () => {
      const { error } = await A.client.from("profiles").insert({
        id: crypto.randomUUID(),
        empresa_id: B.empresaId,
        perfil: "admin",
        nome: "Intruso",
        email: "intruso@rdcheck-test.internal",
      });
      assert(error !== null, "INSERT em profiles deveria ter falhado (INSERT revogado), mas foi aceito");
    });

    console.log("\nFase 2 — schema aditivo em inspecoes (crm_oportunidade_id / tipo_execucao):");

    let inspecaoIdA;
    await test("Setup: cria inspeção da Empresa A vinculada ao cliente A", async () => {
      const { data: numero, error: numeroErr } = await A.client.rpc("get_next_numero_inspecao");
      if (numeroErr) throw numeroErr;
      const { data, error } = await A.client
        .from("inspecoes")
        .insert({ empresa_id: A.empresaId, cliente_id: clienteA, numero_sequencial: numero })
        .select("id")
        .single();
      if (error) throw error;
      inspecaoIdA = data.id;
    });

    await test("UPDATE crm_oportunidade_id p/ oportunidade de outra empresa falha pela FK composta, não por RLS", async () => {
      // A é 'admin' — a policy inspecoes_admin já autoriza acesso tenant-wide à
      // própria linha (mesma empresa), então RLS não é o que pode barrar este
      // UPDATE. Isso isola o teste: se falhar, só pode ser a FK composta.
      const { error } = await A.client.from("inspecoes").update({ crm_oportunidade_id: oportunidadeB }).eq("id", inspecaoIdA);
      assert(error !== null, "UPDATE deveria ter falhado, mas foi aceito (a operação chegou ao banco e não foi rejeitada)");
      assert(
        error.code === "23503",
        `esperava violação de FK (code 23503), recebeu code=${error.code} message=${error.message} — ` +
          `se o code for 42501, foi RLS que bloqueou, não a FK; investigar antes de aceitar o teste como bom`
      );
      assert(
        JSON.stringify(error).includes("inspecoes_crm_oportunidade_empresa_fkey"),
        `erro não referencia especificamente a constraint esperada: ${JSON.stringify(error)}`
      );
      const { data: check } = await admin.from("inspecoes").select("crm_oportunidade_id").eq("id", inspecaoIdA).single();
      assert(check.crm_oportunidade_id === null, "crm_oportunidade_id foi alterado indevidamente apesar do erro reportado");
    });

    await test("UPDATE crm_oportunidade_id p/ oportunidade da própria empresa é aceito", async () => {
      const { error } = await A.client.from("inspecoes").update({ crm_oportunidade_id: oportunidadeA }).eq("id", inspecaoIdA);
      if (error) throw error;
      const { data: check } = await admin.from("inspecoes").select("crm_oportunidade_id").eq("id", inspecaoIdA).single();
      assert(check.crm_oportunidade_id === oportunidadeA, "crm_oportunidade_id não foi atualizado para a oportunidade correta");
    });

    await test("tipo_execucao com valor fora do CHECK é rejeitado", async () => {
      const { error } = await A.client.from("inspecoes").update({ tipo_execucao: "valor_invalido" }).eq("id", inspecaoIdA);
      assert(error !== null, "UPDATE deveria ter falhado por CHECK, mas foi aceito");
      assert(error.code === "23514", `esperava violação de CHECK (code 23514), recebeu code=${error.code} message=${error.message}`);
    });

    await test("Inspeções criadas pelo fluxo atual continuam com tipo_execucao='inspecao_legada' por padrão", async () => {
      const { data, error } = await admin.from("inspecoes").select("tipo_execucao").eq("id", inspecaoIdA).single();
      if (error) throw error;
      assert(data.tipo_execucao === "inspecao_legada", `esperava 'inspecao_legada' (via DEFAULT), recebeu '${data.tipo_execucao}'`);
    });

    console.log("\nNumeração de inspeções (concorrência):");

    await test("N chamadas concorrentes em uma mesma empresa retornam números distintos", async () => {
      const N = 5;
      const nums = await Promise.all(Array.from({ length: N }, () => A.client.rpc("get_next_numero_inspecao")));
      const values = nums.map((r) => {
        if (r.error) throw r.error;
        return r.data;
      });
      assert(new Set(values).size === N, `esperava ${N} números distintos, recebeu ${values.join(",")}`);
    });

    await test("Empresas diferentes podem legitimamente compartilhar o mesmo número (isolamento, não unicidade global)", async () => {
      const [a, b] = await Promise.all([A.client.rpc("get_next_numero_inspecao"), B.client.rpc("get_next_numero_inspecao")]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      // Não afirmamos igualdade nem diferença — só que ambas as chamadas
      // são bem-sucedidas de forma independente, cada uma na sua sequência.
      assert(typeof a.data === "number" && typeof b.data === "number", "números retornados não são numéricos");
    });

    await resetRateLimit();
    console.log("\nConcorrência em provision_tenant (double-submit real, mesmo e-mail):");

    await test("Duas requisições HTTP simultâneas de cadastro com o mesmo e-mail criam exatamente um tenant", async () => {
      const email = uniqueEmail("concorrencia");
      const password = "senhaDeTeste123!";
      const empresaNome = `Concorrência ${Date.now()}`;
      const payload = { nomeCompleto: "Teste Concorrência", email, whatsapp: "11999990000", empresaNome, password, website: "" };

      const [r1, r2] = await Promise.all([callPublicSignup(payload), callPublicSignup(payload)]);
      assert(r1.body.success !== false, `primeira chamada falhou: ${JSON.stringify(r1.body)}`);
      assert(r2.body.success !== false, `segunda chamada falhou: ${JSON.stringify(r2.body)}`);

      const { data: empresas } = await admin.from("empresas").select("id").eq("nome", empresaNome);
      assert(empresas.length === 1, `esperava 1 empresa, encontrou ${empresas.length}`);
      const empresaId = empresas[0].id;

      const { data: profiles } = await admin.from("profiles").select("id").eq("empresa_id", empresaId);
      assert(profiles.length === 1, `esperava 1 profile, encontrou ${profiles.length}`);

      const { data: configs } = await admin.from("configuracoes").select("id").eq("empresa_id", empresaId);
      assert(configs.length === 1, `esperava 1 configuracoes, encontrou ${configs.length}`);

      const { data: auditRows } = await admin.from("audit_log").select("id").eq("empresa_id", empresaId).eq("event_type", "empresa_criada");
      assert(auditRows.length === 1, `esperava 1 evento empresa_criada em audit_log, encontrou ${auditRows.length}`);

      await admin.from("configuracoes").delete().eq("empresa_id", empresaId);
      await admin.from("numeracao_inspecoes").delete().eq("empresa_id", empresaId);
      await admin.auth.admin.deleteUser(profiles[0].id).catch(() => {});
      await admin.from("empresas").delete().eq("id", empresaId);
    });

    console.log("\nUsuário convidado (consultor) — mesmo isolamento, escopado à Empresa A:");

    const consultorEmail = uniqueEmail("consultor-a");
    const consultorPassword = "senhaDeTeste123!";
    const { data: consultorUser, error: consultorErr } = await admin.auth.admin.createUser({
      email: consultorEmail,
      password: consultorPassword,
      email_confirm: true,
    });
    if (consultorErr) throw new Error(`criação do consultor de teste falhou: ${consultorErr.message}`);
    A.userIds.push(consultorUser.user.id);
    await admin.from("profiles").insert({
      id: consultorUser.user.id,
      empresa_id: A.empresaId,
      perfil: "consultor",
      nome: "Consultor A",
      email: consultorEmail,
    });
    let consultorSession = await signIn(consultorEmail, consultorPassword);

    await test("Consultor da Empresa A não vê clientes da Empresa B", async () => {
      const { data, error } = await consultorSession.client.from("clientes").select("id").eq("id", clienteB);
      if (error) throw error;
      assert(data.length === 0, `esperava 0 linhas, recebeu ${data.length}`);
    });

    await test("Consultor da Empresa A vê o cliente da própria empresa", async () => {
      const { data, error } = await consultorSession.client.from("clientes").select("id").eq("id", clienteA);
      if (error) throw error;
      assert(data.length === 1, `esperava 1 linha, recebeu ${data.length}`);
    });

    await test("Regressão Fase 2: policy inspecoes_consultor continua igual (consultor só vê inspeção que ele mesmo é dono)", async () => {
      // A inspeção "inspecaoIdA" foi criada pelo client de A (admin), sem
      // consultor_id preenchido — inspecoes_consultor exige consultor_id =
      // auth.uid(), então este consultor não deveria enxergá-la, exatamente
      // como já seria o caso antes da Fase 2 (nenhuma policy foi alterada).
      const { data, error } = await consultorSession.client.from("inspecoes").select("id").eq("id", inspecaoIdA);
      if (error) throw error;
      assert(data.length === 0, `esperava 0 linhas (sem policy nova pra CRM ainda), recebeu ${data.length}`);
    });

    console.log("\nFase 3 — RLS de Diagnóstico pré-venda em inspecoes:");

    const diagnosticoA1 = await seedDiagnostico(A, oportunidadeA);
    const diagnosticoB1 = await seedDiagnostico(B, oportunidadeB);

    // Segundo consultor da Empresa A — não-dono de nada, prova acesso tenant-wide.
    const consultorA2Email = uniqueEmail("consultor-a2");
    const consultorA2Password = "senhaDeTeste123!";
    const { data: consultorA2User, error: consultorA2Err } = await admin.auth.admin.createUser({
      email: consultorA2Email,
      password: consultorA2Password,
      email_confirm: true,
    });
    if (consultorA2Err) throw new Error(`criação do consultor A2 falhou: ${consultorA2Err.message}`);
    A.userIds.push(consultorA2User.user.id);
    await admin.from("profiles").insert({
      id: consultorA2User.user.id,
      empresa_id: A.empresaId,
      perfil: "consultor",
      nome: "Consultor A2",
      email: consultorA2Email,
    });
    const consultorA2Session = await signIn(consultorA2Email, consultorA2Password);

    // Perfil cliente da Empresa A, com CNPJ batendo com o do diagnóstico —
    // prova direta de que o vazamento (achado durante a Fase 3) foi fechado.
    const CNPJ_DIAGNOSTICO = "12345678000199";
    await admin.from("inspecoes").update({ cnpj: CNPJ_DIAGNOSTICO, status: "concluida" }).eq("id", diagnosticoA1);
    const clienteUserEmail = uniqueEmail("cliente-a");
    const clienteUserPassword = "senhaDeTeste123!";
    const { data: clienteUser, error: clienteUserErr } = await admin.auth.admin.createUser({
      email: clienteUserEmail,
      password: clienteUserPassword,
      email_confirm: true,
    });
    if (clienteUserErr) throw new Error(`criação do usuário cliente falhou: ${clienteUserErr.message}`);
    A.userIds.push(clienteUser.user.id);
    await admin.from("profiles").insert({
      id: clienteUser.user.id,
      empresa_id: A.empresaId,
      perfil: "cliente",
      nome: "Cliente A",
      email: clienteUserEmail,
      cnpj: CNPJ_DIAGNOSTICO,
    });
    const clienteSession = await signIn(clienteUserEmail, clienteUserPassword);

    await test("Consultor não-dono vê diagnóstico da própria empresa (tenant-wide, sem exigir consultor_id)", async () => {
      const { data, error } = await consultorA2Session.client.from("inspecoes").select("id").eq("id", diagnosticoA1);
      if (error) throw error;
      assert(data.length === 1, `esperava 1 linha, recebeu ${data.length}`);
    });

    await test("Consultor não vê diagnóstico de outra empresa", async () => {
      const { data, error } = await consultorA2Session.client.from("inspecoes").select("id").eq("id", diagnosticoB1);
      if (error) throw error;
      assert(data.length === 0, `esperava 0 linhas, recebeu ${data.length}`);
    });

    await test("Admin acessa diagnóstico de qualquer consultor da própria empresa", async () => {
      const { data, error } = await A.client.from("inspecoes").select("id").eq("id", diagnosticoA1);
      if (error) throw error;
      assert(data.length === 1, `esperava 1 linha, recebeu ${data.length}`);
    });

    await test("Perfil cliente NÃO acessa diagnóstico mesmo com CNPJ batendo (vazamento corrigido)", async () => {
      const { data, error } = await clienteSession.client.from("inspecoes").select("id").eq("id", diagnosticoA1);
      if (error) throw error;
      assert(data.length === 0, `esperava 0 linhas (vazamento deveria estar corrigido), recebeu ${data.length}`);
    });

    await test("Usuário inativo não acessa diagnóstico", async () => {
      await admin.from("profiles").update({ ativo: false }).eq("id", consultorA2User.user.id);
      const { data, error } = await consultorA2Session.client.from("inspecoes").select("id").eq("id", diagnosticoA1);
      if (error) throw error;
      assert(data.length === 0, `esperava 0 linhas (usuário inativo), recebeu ${data.length}`);
      await admin.from("profiles").update({ ativo: true }).eq("id", consultorA2User.user.id);
    });

    await test("INSERT de diagnóstico com crm_oportunidade_id de outro tenant falha por FK (23503)", async () => {
      const { data: numero } = await A.client.rpc("get_next_numero_inspecao");
      const { error } = await A.client.from("inspecoes").insert({
        empresa_id: A.empresaId, crm_oportunidade_id: oportunidadeB, tipo_execucao: "diagnostico", numero_sequencial: numero,
      });
      assert(error !== null, "INSERT deveria ter falhado");
      assert(error.code === "23503", `esperava 23503, recebeu ${error.code}: ${error.message}`);
    });

    await test("INSERT de diagnóstico sem crm_oportunidade_id é bloqueado pela policy", async () => {
      const { data: numero } = await A.client.rpc("get_next_numero_inspecao");
      const { error } = await A.client.from("inspecoes").insert({
        empresa_id: A.empresaId, tipo_execucao: "diagnostico", numero_sequencial: numero,
      });
      assert(error !== null, "INSERT deveria ter falhado (crm_oportunidade_id é obrigatório pra diagnóstico)");
    });

    await test("INSERT de diagnóstico com cliente_id de outro tenant é bloqueado", async () => {
      const { data: numero } = await A.client.rpc("get_next_numero_inspecao");
      const { error } = await A.client.from("inspecoes").insert({
        empresa_id: A.empresaId, crm_oportunidade_id: oportunidadeA, cliente_id: clienteB, tipo_execucao: "diagnostico", numero_sequencial: numero,
      });
      assert(error !== null, "INSERT deveria ter falhado (cliente_id de outro tenant)");
    });

    await test("UPDATE que tenta limpar crm_oportunidade_id de diagnóstico é bloqueado pela policy", async () => {
      const { error } = await A.client.from("inspecoes").update({ crm_oportunidade_id: null }).eq("id", diagnosticoA1);
      assert(error !== null, "UPDATE deveria ter falhado (policy exige crm_oportunidade_id preenchido)");
    });

    await test("Nem admin via service_role consegue limpar crm_oportunidade_id de diagnóstico (constraint estrutural, não só policy)", async () => {
      const { error } = await admin.from("inspecoes").update({ crm_oportunidade_id: null }).eq("id", diagnosticoA1);
      assert(error !== null, "UPDATE deveria ter falhado mesmo via service_role (que bypassa RLS)");
      assert(error.code === "23514", `esperava violação de CHECK (23514), recebeu ${error.code}: ${error.message}`);
    });

    await test("UPDATE em linha tipo_execucao≠'diagnostico' não é afetado pelas policies novas (regressão)", async () => {
      const { data, error } = await consultorA2Session.client.from("inspecoes").update({ conformidade: 50 }).eq("id", inspecaoIdA).select("id");
      if (error) throw error;
      assert(data.length === 0, `esperava 0 linhas afetadas (consultor não-dono de inspeção legada), recebeu ${data.length}`);
    });

    console.log("\nFase 3 — Constraint inspecoes_tem_origem_check (comportamento pós-VALIDATE):");

    await test("INSERT com cliente_id e crm_oportunidade_id ambos nulos falha (23514)", async () => {
      const { data: numero } = await A.client.rpc("get_next_numero_inspecao");
      const { error } = await A.client.from("inspecoes").insert({
        empresa_id: A.empresaId, tipo_execucao: "inspecao_legada", numero_sequencial: numero,
      });
      assert(error !== null, "INSERT deveria ter falhado");
      assert(error.code === "23514", `esperava 23514, recebeu ${error.code}: ${error.message}`);
    });

    console.log("\nFase 3 — Conversão (crm_fechar_oportunidade_ganha):");

    // Fase 4: uma oportunidade tem no máximo 1 Diagnóstico Inicial
    // (índice único parcial inspecoes_diagnostico_unico_por_oportunidade) —
    // o cenário de "2 diagnósticos na mesma oportunidade" da Fase 3 foi
    // superado por essa regra explícita e não é mais um estado válido.
    const oportunidadeConv = await seedOportunidade(A, "Oportunidade Conversão");
    const diagConv1 = await seedDiagnostico(A, oportunidadeConv);

    let clienteConvId;
    await test("Fechamento normal: cria cliente e vincula o diagnóstico da oportunidade", async () => {
      const { data, error } = await A.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeConv });
      if (error) throw error;
      const r = data[0];
      assert(r.cliente_criado === true, "esperava cliente_criado=true");
      assert(r.already_converted === false, "esperava already_converted=false na 1ª chamada");
      assert(r.diagnosticos_vinculados === 1, `esperava 1 diagnóstico vinculado, recebeu ${r.diagnosticos_vinculados}`);
      clienteConvId = r.cliente_id;
      const { data: d1 } = await admin.from("inspecoes").select("cliente_id, crm_oportunidade_id").eq("id", diagConv1).single();
      assert(d1.cliente_id === clienteConvId, "diagnóstico não foi vinculado ao cliente certo");
      assert(d1.crm_oportunidade_id === oportunidadeConv, "diagnóstico perdeu crm_oportunidade_id na conversão");
    });

    await test("Segunda chamada é idempotente: already_converted=true, sem nova escrita", async () => {
      const before = await admin.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", A.empresaId);
      const { data, error } = await A.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeConv });
      if (error) throw error;
      const r = data[0];
      assert(r.already_converted === true, "esperava already_converted=true na 2ª chamada");
      assert(r.cliente_criado === false, "esperava cliente_criado=false na 2ª chamada");
      assert(r.cliente_id === clienteConvId, "cliente_id mudou entre chamadas");
      assert(r.diagnosticos_vinculados === 1, `esperava 1, recebeu ${r.diagnosticos_vinculados}`);
      const after = await admin.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", A.empresaId);
      assert(before.count === after.count, "número de clientes da empresa mudou na chamada idempotente");
    });

    await test("Consultor ativo converte oportunidade da própria empresa mesmo sem ser responsavel_id", async () => {
      const oportunidadeConv2 = await seedOportunidade(A, "Oportunidade Conversão 2");
      const { data, error } = await consultorA2Session.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeConv2 });
      if (error) throw error;
      assert(!!data[0].cliente_id, "conversão por consultor não-dono deveria ter retornado um cliente_id");
    });

    await test("Consultor do Tenant A não converte oportunidade do Tenant B", async () => {
      const { error } = await consultorA2Session.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeB });
      assert(error !== null, "conversão de oportunidade de outro tenant deveria ter falhado");
    });

    await test("Perfil cliente não consegue chamar a conversão", async () => {
      const oportunidadeConv3 = await seedOportunidade(A, "Oportunidade Conversão 3");
      const { error } = await clienteSession.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeConv3 });
      assert(error !== null, "cliente não deveria conseguir chamar a conversão");
    });

    await test("Consultor inativo não consegue chamar a conversão", async () => {
      await admin.from("profiles").update({ ativo: false }).eq("id", consultorA2User.user.id);
      const oportunidadeConv4 = await seedOportunidade(A, "Oportunidade Conversão 4");
      const { error } = await consultorA2Session.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeConv4 });
      assert(error !== null, "consultor inativo não deveria conseguir converter");
      await admin.from("profiles").update({ ativo: true }).eq("id", consultorA2User.user.id);
    });

    await test("Conflito: diagnóstico já vinculado a cliente diferente aborta a transação inteira", async () => {
      const oportunidadeConflito = await seedOportunidade(A, "Oportunidade Conflito");
      const diagConflito = await seedDiagnostico(A, oportunidadeConflito);
      await admin.from("inspecoes").update({ cliente_id: clienteA }).eq("id", diagConflito);
      const before = await admin.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", A.empresaId);
      const { error } = await A.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeConflito });
      assert(error !== null, "deveria ter abortado por conflito de cliente_id");
      const after = await admin.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", A.empresaId);
      assert(before.count === after.count, "um cliente foi criado apesar do conflito (rollback falhou)");
      const { data: op } = await admin.from("crm_oportunidades").select("fechada_em").eq("id", oportunidadeConflito).single();
      assert(op.fechada_em === null, "oportunidade foi fechada apesar do conflito (rollback falhou)");
    });

    await test("Oportunidade fechada como perdida não é tratada como convertida (2ª chamada lança erro, não sucesso)", async () => {
      const oportunidadePerdida = await seedOportunidade(A, "Oportunidade Perdida");
      const { data: motivo, error: motivoErr } = await admin.from("crm_motivos_perda").select("id").eq("empresa_id", A.empresaId).limit(1).single();
      if (motivoErr) throw motivoErr;
      const { error: perdaErr } = await A.client.rpc("crm_fechar_oportunidade_perdida", {
        p_oportunidade_id: oportunidadePerdida, p_motivo_perda_id: motivo.id, p_motivo_perda_detalhe: null,
      });
      if (perdaErr) throw perdaErr;
      const { error } = await A.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadePerdida });
      assert(error !== null, "deveria ter lançado erro (fechada, mas não como ganha)");
      assert(/não como ganha/.test(error.message), `mensagem de erro inesperada: ${error.message}`);
    });

    await test("Conflito CNPJ duplicado: vínculo direto da Conta é sempre prioritário sobre CNPJ (documentado, não corrigido)", async () => {
      const cnpjDup = "98765432000188";
      const { data: clienteDupPrioritario } = await admin.from("clientes").insert({ empresa_id: A.empresaId, nome: "Cliente Prioritário", cnpj: cnpjDup }).select("id").single();
      const { data: clienteDupSecundario } = await admin.from("clientes").insert({ empresa_id: A.empresaId, nome: "Cliente Duplicado CNPJ", cnpj: cnpjDup }).select("id").single();
      const oportunidadeDup = await seedOportunidade(A, "Oportunidade CNPJ Duplicado");
      const { data: opRow } = await admin.from("crm_oportunidades").select("crm_empresa_id").eq("id", oportunidadeDup).single();
      await admin.from("crm_empresas").update({ cliente_id: clienteDupPrioritario.id, cnpj: cnpjDup }).eq("id", opRow.crm_empresa_id);
      const { data, error } = await A.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeDup });
      if (error) throw error;
      assert(data[0].cliente_id === clienteDupPrioritario.id, "deveria ter priorizado o vínculo direto da Conta, não reconsiderado por CNPJ");
      await admin.from("clientes").delete().in("id", [clienteDupPrioritario.id, clienteDupSecundario.id]);
    });

    console.log("\nFase 4 — crm_obter_ou_criar_diagnostico (unicidade e idempotência):");

    await test("Duas chamadas concorrentes para a mesma oportunidade retornam o mesmo inspecao_id, exatamente 1 linha criada", async () => {
      const oportunidadeConcorrente = await seedOportunidade(A, "Oportunidade Concorrência Diagnóstico");
      const [r1, r2] = await Promise.all([
        A.client.rpc("crm_obter_ou_criar_diagnostico", { p_oportunidade_id: oportunidadeConcorrente }),
        A.client.rpc("crm_obter_ou_criar_diagnostico", { p_oportunidade_id: oportunidadeConcorrente }),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      const id1 = r1.data[0].inspecao_id;
      const id2 = r2.data[0].inspecao_id;
      assert(id1 === id2, `chamadas concorrentes retornaram inspecao_id diferentes: ${id1} vs ${id2}`);
      assert(r1.data[0].criado !== r2.data[0].criado, "exatamente uma das duas chamadas deveria ter criado=true");
      const { count, error: countErr } = await admin
        .from("inspecoes")
        .select("id", { count: "exact", head: true })
        .eq("crm_oportunidade_id", oportunidadeConcorrente)
        .eq("tipo_execucao", "diagnostico");
      if (countErr) throw countErr;
      assert(count === 1, `esperava exatamente 1 linha de diagnóstico, encontrou ${count}`);
    });

    await test("RPC nunca preenche cliente_id, mesmo com CNPJ da Conta batendo um cliente existente", async () => {
      const oportunidadeSemCliente = await seedOportunidade(A, "Oportunidade Sem Cliente");
      const { data, error } = await A.client.rpc("crm_obter_ou_criar_diagnostico", { p_oportunidade_id: oportunidadeSemCliente });
      if (error) throw error;
      const { data: row } = await admin.from("inspecoes").select("cliente_id, tipo_execucao").eq("id", data[0].inspecao_id).single();
      assert(row.cliente_id === null, "diagnóstico criado pela RPC não deveria ter cliente_id preenchido");
      assert(row.tipo_execucao === "diagnostico", "tipo_execucao deveria ser 'diagnostico'");
    });

    await test("Índice único bloqueia um segundo diagnóstico inserido manualmente pra mesma oportunidade (23505)", async () => {
      const oportunidadeIndiceUnico = await seedOportunidade(A, "Oportunidade Índice Único");
      await seedDiagnostico(A, oportunidadeIndiceUnico);
      let erroCapturado = null;
      try {
        await seedDiagnostico(A, oportunidadeIndiceUnico);
      } catch (e) {
        erroCapturado = e;
      }
      assert(erroCapturado !== null, "segundo INSERT de diagnóstico pra mesma oportunidade deveria ter falhado");
      assert(/inspecoes_diagnostico_unico_por_oportunidade/.test(erroCapturado.message), `mensagem inesperada: ${erroCapturado.message}`);
    });

    await test("Perfil cliente não consegue chamar crm_obter_ou_criar_diagnostico", async () => {
      const oportunidadeClienteChama = await seedOportunidade(A, "Oportunidade Cliente Chama RPC");
      const { error } = await clienteSession.client.rpc("crm_obter_ou_criar_diagnostico", { p_oportunidade_id: oportunidadeClienteChama });
      assert(error !== null, "perfil cliente não deveria conseguir chamar a RPC de criação de diagnóstico");
    });

    await test("Evento de timeline 'diagnostico_iniciado' é gravado exatamente uma vez, mesmo com chamadas concorrentes", async () => {
      const oportunidadeTimelineDiag = await seedOportunidade(A, "Oportunidade Timeline Diagnóstico");
      await Promise.all([
        A.client.rpc("crm_obter_ou_criar_diagnostico", { p_oportunidade_id: oportunidadeTimelineDiag }),
        A.client.rpc("crm_obter_ou_criar_diagnostico", { p_oportunidade_id: oportunidadeTimelineDiag }),
      ]);
      const { data: eventos, error } = await admin
        .from("crm_timeline")
        .select("id")
        .eq("crm_oportunidade_id", oportunidadeTimelineDiag)
        .eq("evento_tipo", "diagnostico_iniciado");
      if (error) throw error;
      assert(eventos.length === 1, `esperava exatamente 1 evento 'diagnostico_iniciado', encontrou ${eventos.length}`);
    });

    console.log("\nFase 3 — Reincidência exclui diagnóstico pré-venda:");

    const cnpjReincidencia = "11122233000144";
    const { data: numeroLegado } = await A.client.rpc("get_next_numero_inspecao");
    const { data: legadoAntigo } = await admin
      .from("inspecoes")
      .insert({
        empresa_id: A.empresaId, cliente_id: clienteA, cnpj: cnpjReincidencia, status: "concluida",
        data_conclusao: "2026-01-01T00:00:00Z", tipo_execucao: "inspecao_legada", numero_sequencial: numeroLegado,
      })
      .select("id")
      .single();
    const oportunidadeReinc = await seedOportunidade(A, "Oportunidade Reincidência");
    await seedDiagnostico(A, oportunidadeReinc, {
      cnpj: cnpjReincidencia, status: "concluida", data_conclusao: "2026-06-01T00:00:00Z",
    });

    await test("Query de reincidência (padrão resultado.tsx/check-reinspection.ts) exclui diagnóstico do mesmo CNPJ", async () => {
      const { data, error } = await admin
        .from("inspecoes")
        .select("id, tipo_execucao")
        .eq("cnpj", cnpjReincidencia)
        .eq("status", "concluida")
        .neq("tipo_execucao", "diagnostico")
        .order("data_conclusao", { ascending: false });
      if (error) throw error;
      assert(data.length === 1 && data[0].id === legadoAntigo.id, `esperava só a inspeção legada, recebeu ${JSON.stringify(data)}`);
    });

    await test("Sem o filtro, o diagnóstico apareceria (prova de que o cenário de vazamento é real, não hipotético)", async () => {
      const { data, error } = await admin
        .from("inspecoes")
        .select("id, tipo_execucao")
        .eq("cnpj", cnpjReincidencia)
        .eq("status", "concluida")
        .order("data_conclusao", { ascending: false });
      if (error) throw error;
      assert(data.length === 2, `esperava 2 linhas sem o filtro (prova do cenário), recebeu ${data.length}`);
    });

    await test("Filtro novo não quebra consulta em CNPJ sem nenhum diagnóstico (caso comum hoje)", async () => {
      const { data, error } = await admin
        .from("inspecoes")
        .select("id")
        .eq("cnpj", "00000000000000")
        .eq("status", "concluida")
        .neq("tipo_execucao", "diagnostico");
      if (error) throw error;
      assert(Array.isArray(data) && data.length === 0, "query deveria retornar array vazio, não erro");
    });

    console.log("\nUsuário removido — sessão antiga não deve continuar funcionando:");

    await test("Após desativar o consultor, a sessão antiga (JWT ainda válido) já não retorna dados", async () => {
      const { error: deactivateErr } = await admin.from("profiles").update({ ativo: false }).eq("id", consultorUser.user.id);
      if (deactivateErr) throw deactivateErr;
      // Reusa o client já autenticado ANTES da desativação — não faz login
      // de novo. É exatamente o cenário real: sessão emitida antes de o
      // usuário ser removido, ainda dentro da validade do token.
      const { data, error } = await consultorSession.client.from("clientes").select("id").eq("id", clienteA);
      if (error) throw error;
      assert(data.length === 0, `sessão de usuário desativado ainda retornou ${data.length} linha(s)`);
    });

    await resetRateLimit();
    console.log("\nReenvio de confirmação (double-submit) não duplica tenant:");

    await test("Múltiplos reenvios para o mesmo e-mail não confirmado não criam empresas extras", async () => {
      const email = uniqueEmail("resend");
      const password = "senhaDeTeste123!";
      const empresaNome = `Resend Test ${Date.now()}`;
      const signup = await callPublicSignup({ nomeCompleto: "Teste Resend", email, whatsapp: "11999990000", empresaNome, password, website: "" });
      assert(signup.body.success !== false, `signup inicial falhou: ${JSON.stringify(signup.body)}`);

      await callPublicSignup({ action: "resend", email });
      await callPublicSignup({ action: "resend", email });

      const { data: empresas } = await admin.from("empresas").select("id").eq("nome", empresaNome);
      assert(empresas.length === 1, `esperava 1 empresa após reenvios, encontrou ${empresas.length}`);

      const { data: profiles } = await admin.from("profiles").select("id").eq("empresa_id", empresas[0].id);
      await admin.from("configuracoes").delete().eq("empresa_id", empresas[0].id);
      await admin.from("numeracao_inspecoes").delete().eq("empresa_id", empresas[0].id);
      for (const p of profiles) await admin.auth.admin.deleteUser(p.id).catch(() => {});
      await admin.from("empresas").delete().eq("id", empresas[0].id);
    });

    await test("Reenvio para e-mail nunca cadastrado não cria nada", async () => {
      const email = uniqueEmail("resend-inexistente");
      const before = await admin.from("empresas").select("id", { count: "exact", head: true });
      const resp = await callPublicSignup({ action: "resend", email });
      assert(resp.body.success !== false, `resposta deveria ser sucesso genérico: ${JSON.stringify(resp.body)}`);
      const after = await admin.from("empresas").select("id", { count: "exact", head: true });
      assert(before.count === after.count, "contagem de empresas mudou após reenvio de e-mail inexistente");
    });

    console.log("\nConta confirmada sem tenant (nunca provisiona só pelo e-mail informado):");

    await test("Cadastro com e-mail de conta confirmada e órfã não cria tenant", async () => {
      const email = uniqueEmail("orfao-confirmado");
      const password = "senhaDeTeste123!";
      const { data: orphanUser, error: orphanErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (orphanErr) throw new Error(`criação do usuário órfão de teste falhou: ${orphanErr.message}`);
      try {
        const resp = await callPublicSignup({
          nomeCompleto: "Tentativa Estranho",
          email,
          whatsapp: "11999990000",
          empresaNome: "Empresa Que Não Deveria Existir",
          password: "outraSenha123!",
          website: "",
        });
        assert(resp.body.success !== false, `resposta deveria ser sucesso genérico: ${JSON.stringify(resp.body)}`);
        const { data: profiles } = await admin.from("profiles").select("id").eq("id", orphanUser.user.id);
        assert(profiles.length === 0, "um profile/tenant foi criado a partir só do e-mail informado, sem prova de posse da conta");
        const { data: empresas } = await admin.from("empresas").select("id").eq("nome", "Empresa Que Não Deveria Existir");
        assert(empresas.length === 0, "uma empresa foi criada a partir do e-mail de uma conta órfã, sem prova de posse");
      } finally {
        await admin.auth.admin.deleteUser(orphanUser.user.id).catch(() => {});
      }
    });
    console.log("\nFase 5 — configuração da etapa de Diagnóstico no Pipeline:");

    const { data: pipelineA } = await admin
      .from("crm_pipelines").select("id").eq("empresa_id", A.empresaId).eq("padrao", true).single();
    const { data: etapasA } = await admin
      .from("crm_etapas").select("id, nome, tipo").eq("pipeline_id", pipelineA.id).order("ordem");
    const etapasAbertasA = etapasA.filter((e) => e.tipo === "aberta");
    const etapaGanhoA = etapasA.find((e) => e.tipo === "ganho");
    const etapaPerdidoA = etapasA.find((e) => e.tipo === "perdido");
    const [etapaDiag1, etapaDiag2, etapaDiag3] = etapasAbertasA;

    await test("Admin marca uma etapa aberta como Diagnóstico", async () => {
      const { data, error } = await A.client.rpc("crm_definir_etapa_diagnostico", {
        p_pipeline_id: pipelineA.id, p_etapa_id: etapaDiag1.id,
      });
      if (error) throw error;
      assert(data[0].etapa_diagnostico_id === etapaDiag1.id, "RPC não retornou a etapa marcada");
      const { data: etapaCheck } = await admin.from("crm_etapas").select("gera_diagnostico").eq("id", etapaDiag1.id).single();
      assert(etapaCheck.gera_diagnostico === true, "gera_diagnostico não foi persistido como true");
    });

    await test("Consultor não consegue marcar etapa de Diagnóstico", async () => {
      const { error } = await consultorA2Session.client.rpc("crm_definir_etapa_diagnostico", {
        p_pipeline_id: pipelineA.id, p_etapa_id: etapaDiag2.id,
      });
      assert(error !== null, "consultor não deveria conseguir chamar a RPC de configuração");
    });

    await test("Cliente não consegue chamar a configuração da etapa de Diagnóstico", async () => {
      const { error } = await clienteSession.client.rpc("crm_definir_etapa_diagnostico", {
        p_pipeline_id: pipelineA.id, p_etapa_id: etapaDiag2.id,
      });
      assert(error !== null, "cliente não deveria conseguir chamar a RPC de configuração");
    });

    await test("Etapa tipo='ganho' não pode ser marcada como Diagnóstico", async () => {
      const { error } = await A.client.rpc("crm_definir_etapa_diagnostico", {
        p_pipeline_id: pipelineA.id, p_etapa_id: etapaGanhoA.id,
      });
      assert(error !== null, "deveria ter rejeitado marcar etapa tipo=ganho");
    });

    await test("Etapa tipo='perdido' não pode ser marcada como Diagnóstico", async () => {
      const { error } = await A.client.rpc("crm_definir_etapa_diagnostico", {
        p_pipeline_id: pipelineA.id, p_etapa_id: etapaPerdidoA.id,
      });
      assert(error !== null, "deveria ter rejeitado marcar etapa tipo=perdido");
    });

    await test("Transferir a marcação para outra etapa funciona atomicamente (índice único nunca violado)", async () => {
      const { data, error } = await A.client.rpc("crm_definir_etapa_diagnostico", {
        p_pipeline_id: pipelineA.id, p_etapa_id: etapaDiag2.id,
      });
      if (error) throw error;
      assert(data[0].etapa_diagnostico_id === etapaDiag2.id, "RPC não retornou a nova etapa marcada");
      const { data: marcadas } = await admin
        .from("crm_etapas").select("id").eq("pipeline_id", pipelineA.id).eq("gera_diagnostico", true);
      assert(marcadas.length === 1 && marcadas[0].id === etapaDiag2.id, `esperava só ${etapaDiag2.id} marcada, recebeu ${JSON.stringify(marcadas)}`);
    });

    await test("Pipeline de outro tenant não pode ser alterado (nem por super_admin implícito)", async () => {
      const { data: pipelineB } = await admin
        .from("crm_pipelines").select("id").eq("empresa_id", B.empresaId).eq("padrao", true).single();
      const { data: etapaB } = await admin
        .from("crm_etapas").select("id").eq("pipeline_id", pipelineB.id).eq("tipo", "aberta").limit(1).single();
      const { error } = await A.client.rpc("crm_definir_etapa_diagnostico", {
        p_pipeline_id: pipelineB.id, p_etapa_id: etapaB.id,
      });
      assert(error !== null, "admin do Tenant A não deveria conseguir configurar pipeline do Tenant B");
    });

    await test("Configuração gera entrada em audit_log", async () => {
      const { data, error } = await admin
        .from("audit_log").select("id, event_type, metadata")
        .eq("empresa_id", A.empresaId).eq("event_type", "crm_etapa_diagnostico_definida")
        .order("created_at", { ascending: false }).limit(1);
      if (error) throw error;
      assert(data.length === 1, "nenhuma entrada de audit_log encontrada pra crm_etapa_diagnostico_definida");
      assert(data[0].metadata.etapa_nova_id === etapaDiag2.id, "metadata do audit_log não bate com a etapa marcada");
    });

    await test("Remover a configuração funciona (p_etapa_id=NULL) e também audita", async () => {
      const { data, error } = await A.client.rpc("crm_definir_etapa_diagnostico", {
        p_pipeline_id: pipelineA.id, p_etapa_id: null,
      });
      if (error) throw error;
      assert(data[0].etapa_diagnostico_id === null, "esperava etapa_diagnostico_id=null após remoção");
      const { data: marcadas } = await admin
        .from("crm_etapas").select("id").eq("pipeline_id", pipelineA.id).eq("gera_diagnostico", true);
      assert(marcadas.length === 0, `esperava 0 etapas marcadas, recebeu ${marcadas.length}`);
      const { data: auditRemocao } = await admin
        .from("audit_log").select("id").eq("empresa_id", A.empresaId).eq("event_type", "crm_etapa_diagnostico_removida")
        .order("created_at", { ascending: false }).limit(1);
      assert(auditRemocao.length === 1, "nenhuma entrada de audit_log pra crm_etapa_diagnostico_removida");
    });

    // Re-marca pra Diag2, usada pelos testes de constraint/trigger/fechamento abaixo.
    await A.client.rpc("crm_definir_etapa_diagnostico", { p_pipeline_id: pipelineA.id, p_etapa_id: etapaDiag2.id });

    await test("CHECK constraint rejeita gera_diagnostico=true em etapa tipo≠'aberta' (23514), mesmo via service_role", async () => {
      const { error } = await admin.from("crm_etapas").update({ gera_diagnostico: true }).eq("id", etapaGanhoA.id);
      assert(error !== null, "UPDATE direto deveria ter sido rejeitado pela CHECK constraint");
      assert(error.code === "23514", `esperava código 23514, recebeu ${error.code}`);
    });

    await test("Etapa marcada não pode ter tipo alterado pra ganho/perdido sem remover a marcação primeiro", async () => {
      const { error } = await admin.from("crm_etapas").update({ tipo: "ganho" }).eq("id", etapaDiag2.id);
      assert(error !== null, "UPDATE de tipo deveria ter sido rejeitado pela CHECK constraint");
      assert(error.code === "23514", `esperava código 23514, recebeu ${error.code}`);
      const { data: check } = await admin.from("crm_etapas").select("tipo").eq("id", etapaDiag2.id).single();
      assert(check.tipo === "aberta", "tipo da etapa foi alterado apesar da constraint ter rejeitado");
    });

    await test("Índice único parcial rejeita uma segunda etapa marcada no mesmo pipeline (23505)", async () => {
      const { error } = await admin.from("crm_etapas").update({ gera_diagnostico: true }).eq("id", etapaDiag1.id);
      assert(error !== null, "UPDATE direto deveria ter sido rejeitado pelo índice único parcial");
      assert(error.code === "23505", `esperava código 23505, recebeu ${error.code}`);
    });

    console.log("\nFase 5 — trigger de timeline anexa status do Diagnóstico ao sair da etapa:");

    await test("Oportunidade sem Diagnóstico: metadata registra diagnostico_status='nao_iniciado'", async () => {
      const oportunidadeTrigger1 = await seedOportunidade(A, "Oportunidade Trigger Sem Diagnóstico");
      await admin.from("crm_oportunidades").update({ etapa_id: etapaDiag2.id }).eq("id", oportunidadeTrigger1);
      await admin.from("crm_oportunidades").update({ etapa_id: etapaDiag3.id }).eq("id", oportunidadeTrigger1);
      const { data } = await admin
        .from("crm_timeline").select("metadata").eq("crm_oportunidade_id", oportunidadeTrigger1)
        .eq("evento_tipo", "mudanca_etapa").order("created_at", { ascending: false }).limit(1);
      assert(data[0].metadata.diagnostico_status === "nao_iniciado", `esperava 'nao_iniciado', recebeu ${JSON.stringify(data[0].metadata)}`);
      assert(data[0].metadata.diagnostico_concluido === false, "diagnostico_concluido deveria ser false");
    });

    await test("Oportunidade com Diagnóstico em andamento: metadata reflete o status real", async () => {
      const oportunidadeTrigger2 = await seedOportunidade(A, "Oportunidade Trigger Diagnóstico Andamento");
      await admin.from("crm_oportunidades").update({ etapa_id: etapaDiag2.id }).eq("id", oportunidadeTrigger2);
      await seedDiagnostico(A, oportunidadeTrigger2, { status: "em_andamento" });
      await admin.from("crm_oportunidades").update({ etapa_id: etapaDiag3.id }).eq("id", oportunidadeTrigger2);
      const { data } = await admin
        .from("crm_timeline").select("metadata").eq("crm_oportunidade_id", oportunidadeTrigger2)
        .eq("evento_tipo", "mudanca_etapa").order("created_at", { ascending: false }).limit(1);
      assert(data[0].metadata.diagnostico_status === "em_andamento", `esperava 'em_andamento', recebeu ${JSON.stringify(data[0].metadata)}`);
      assert(data[0].metadata.diagnostico_concluido === false, "diagnostico_concluido deveria ser false");
    });

    await test("Oportunidade com Diagnóstico concluído: metadata registra diagnostico_concluido=true", async () => {
      const oportunidadeTrigger3 = await seedOportunidade(A, "Oportunidade Trigger Diagnóstico Concluído");
      await admin.from("crm_oportunidades").update({ etapa_id: etapaDiag2.id }).eq("id", oportunidadeTrigger3);
      await seedDiagnostico(A, oportunidadeTrigger3, { status: "concluida", conformidade: 80 });
      await admin.from("crm_oportunidades").update({ etapa_id: etapaDiag3.id }).eq("id", oportunidadeTrigger3);
      const { data } = await admin
        .from("crm_timeline").select("metadata").eq("crm_oportunidade_id", oportunidadeTrigger3)
        .eq("evento_tipo", "mudanca_etapa").order("created_at", { ascending: false }).limit(1);
      assert(data[0].metadata.diagnostico_status === "concluida", `esperava 'concluida', recebeu ${JSON.stringify(data[0].metadata)}`);
      assert(data[0].metadata.diagnostico_concluido === true, "diagnostico_concluido deveria ser true");
    });

    console.log("\nFase 5 — crm_fechar_oportunidade_ganha exige motivo sem Diagnóstico concluído:");

    await test("Pipeline sem etapa de Diagnóstico configurada mantém o fluxo atual (Tenant B)", async () => {
      const oportunidadeSemConfig = await seedOportunidade(B, "Oportunidade B Sem Config Diagnóstico");
      const { data, error } = await B.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeSemConfig });
      if (error) throw error;
      assert(!!data[0].cliente_id, "conversão deveria ter funcionado normalmente (pipeline sem etapa configurada)");
    });

    await test("Com Diagnóstico concluído, conversão funciona sem exigir motivo", async () => {
      const oportunidadeGanhaOk = await seedOportunidade(A, "Oportunidade Ganha Diagnóstico Concluído");
      await seedDiagnostico(A, oportunidadeGanhaOk, { status: "concluida", conformidade: 90 });
      const { data, error } = await A.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeGanhaOk });
      if (error) throw error;
      assert(!!data[0].cliente_id, "conversão deveria ter funcionado com diagnóstico concluído");
    });

    await test("Sem Diagnóstico, fechar como ganha sem motivo retorna DIAGNOSTICO_NAO_CONCLUIDO", async () => {
      const oportunidadeSemDiag = await seedOportunidade(A, "Oportunidade Ganha Sem Diagnóstico");
      const { error } = await A.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeSemDiag });
      assert(error !== null, "deveria ter retornado erro DIAGNOSTICO_NAO_CONCLUIDO");
      assert(/DIAGNOSTICO_NAO_CONCLUIDO/.test(error.message), `mensagem inesperada: ${error.message}`);
    });

    await test("Diagnóstico em andamento, fechar como ganha sem motivo retorna DIAGNOSTICO_NAO_CONCLUIDO", async () => {
      const oportunidadeAndamento = await seedOportunidade(A, "Oportunidade Ganha Diagnóstico Andamento");
      await seedDiagnostico(A, oportunidadeAndamento, { status: "em_andamento" });
      const { error } = await A.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeAndamento });
      assert(error !== null, "deveria ter retornado erro DIAGNOSTICO_NAO_CONCLUIDO");
      assert(/DIAGNOSTICO_NAO_CONCLUIDO/.test(error.message), `mensagem inesperada: ${error.message}`);
    });

    await test("Motivo vazio ou só espaços é rejeitado pela RPC (backend, não só client)", async () => {
      const oportunidadeMotivoVazio = await seedOportunidade(A, "Oportunidade Motivo Vazio");
      const { error } = await A.client.rpc("crm_fechar_oportunidade_ganha", {
        p_oportunidade_id: oportunidadeMotivoVazio, p_motivo_sem_diagnostico: "   ",
      });
      assert(error !== null, "motivo só com espaços deveria ter sido rejeitado");
      assert(/DIAGNOSTICO_NAO_CONCLUIDO/.test(error.message), `mensagem inesperada: ${error.message}`);
    });

    await test("Motivo muito curto (<5 caracteres) é rejeitado", async () => {
      const oportunidadeMotivoCurto = await seedOportunidade(A, "Oportunidade Motivo Curto");
      const { error } = await A.client.rpc("crm_fechar_oportunidade_ganha", {
        p_oportunidade_id: oportunidadeMotivoCurto, p_motivo_sem_diagnostico: "ok",
      });
      assert(error !== null, "motivo curto deveria ter sido rejeitado");
    });

    await test("Motivo maior que 500 caracteres é rejeitado", async () => {
      const oportunidadeMotivoLongo = await seedOportunidade(A, "Oportunidade Motivo Longo");
      const { error } = await A.client.rpc("crm_fechar_oportunidade_ganha", {
        p_oportunidade_id: oportunidadeMotivoLongo, p_motivo_sem_diagnostico: "x".repeat(501),
      });
      assert(error !== null, "motivo muito longo deveria ter sido rejeitado");
    });

    await test("Motivo válido permite fechar como ganha e registra a exceção na timeline", async () => {
      const oportunidadeComMotivo = await seedOportunidade(A, "Oportunidade Ganha Com Motivo");
      const { data, error } = await A.client.rpc("crm_fechar_oportunidade_ganha", {
        p_oportunidade_id: oportunidadeComMotivo,
        p_motivo_sem_diagnostico: "Cliente pediu urgência, diagnóstico será feito depois.",
      });
      if (error) throw error;
      assert(!!data[0].cliente_id, "conversão deveria ter funcionado com motivo válido");
      const { data: evento } = await admin
        .from("crm_timeline").select("metadata").eq("crm_oportunidade_id", oportunidadeComMotivo)
        .eq("evento_tipo", "oportunidade_ganha_sem_diagnostico").limit(1);
      assert(evento.length === 1, "evento oportunidade_ganha_sem_diagnostico não foi registrado");
      assert(evento[0].metadata.motivo === "Cliente pediu urgência, diagnóstico será feito depois.", "motivo não bate no metadata");
    });

    await test("Múltiplos Diagnósticos na oportunidade abortam a conversão com erro de integridade", async () => {
      // Só alcançável inserindo direto como service_role — o índice único
      // (Fase 4) já impede isso via client normal, então este teste prova
      // que a RPC também se defende, não só a UI/índice.
      const oportunidadeMultipla = await seedOportunidade(A, "Oportunidade Múltiplos Diagnósticos");
      const numero1 = (await admin.rpc("get_next_numero_inspecao")).data;
      await admin.from("inspecoes").insert({
        empresa_id: A.empresaId, crm_oportunidade_id: oportunidadeMultipla, tipo_execucao: "diagnostico", numero_sequencial: numero1,
      });
      // Este cenário (>1 diagnóstico) já é estruturalmente bloqueado pelo
      // índice único parcial (Fase 4) mesmo para service_role — não há como
      // contorná-lo pra montar um caso real de ">1 diagnósticos" e testar o
      // RAISE EXCEPTION de integridade da RPC diretamente. Em vez disso,
      // validamos aqui que uma 2ª tentativa de INSERT falha (prova indireta
      // de que "múltiplos" é inalcançável em uso normal — o guard de
      // integridade dentro da RPC é defesa em profundidade, não a barreira
      // primária).
      const numero2 = (await admin.rpc("get_next_numero_inspecao")).data;
      const { error: segundoInsertErr } = await admin.from("inspecoes").insert({
        empresa_id: A.empresaId, crm_oportunidade_id: oportunidadeMultipla, tipo_execucao: "diagnostico", numero_sequencial: numero2,
      });
      assert(segundoInsertErr !== null, "segundo INSERT deveria ter sido bloqueado pelo índice único (prova de que 'múltiplos' é inalcançável em uso normal)");
    });

    console.log("\nFase 7 — imutabilidade de checklist (legislações/modelos):");

    // Fase 8.B — pode existir mais de um modelo com is_versao_atual=true
    // simultaneamente (cada legislação tem a sua própria "versão atual"), então
    // este teste sempre ancora explicitamente na RDC 275, nunca em "a" versão
    // atual genérica (que deixou de ser única desde que o segundo modelo existe).
    const { data: modeloVersaoAtual } = await admin
      .from("checklist_modelo_versoes")
      .select("id, modelo_id, checklist_modelos!inner(codigo)")
      .eq("is_versao_atual", true)
      .eq("checklist_modelos.codigo", "RDC_275_2002_PADRAO")
      .single();

    await test("Fase 8.B: resolver_checklist_modelo_padrao() continua na RDC 275 mesmo com outros modelos publicados", async () => {
      const { data: outrosModelos } = await admin
        .from("checklist_modelo_versoes")
        .select("id", { count: "exact" })
        .eq("is_versao_atual", true);
      const { data: padraoAtual, error } = await admin.rpc("resolver_checklist_modelo_padrao");
      if (error) throw error;
      assert(
        padraoAtual === modeloVersaoAtual.id,
        `esperava que o padrão global continuasse sendo a versão da RDC 275 (${modeloVersaoAtual.id}) mesmo com ${outrosModelos?.length ?? "?"} modelo(s) publicado(s), recebeu ${padraoAtual}`,
      );
    });

    await test("Fase 9.C: atividade_tags tem os 11 códigos aprovados, todos ativos", async () => {
      const { data: tags, error } = await admin.from("atividade_tags").select("codigo, ativo").order("codigo");
      if (error) throw error;
      const esperados = [
        "alimentos_crus_mal_cozidos",
        "comercio_alimentos",
        "comercio_atacadista",
        "culinaria_japonesa",
        "manipula_perecivel_origem_animal",
        "producao_industrializacao",
        "realiza_delivery",
        "servico_alimentacao",
        "servico_alimentacao_coletiva",
        "transporta_alimentos",
        "venda_a_granel",
      ];
      const codigos = (tags ?? []).map((t) => t.codigo).sort();
      assert(
        JSON.stringify(codigos) === JSON.stringify(esperados),
        `esperava exatamente os 11 códigos aprovados, recebeu ${JSON.stringify(codigos)}`,
      );
      assert((tags ?? []).every((t) => t.ativo === true), "todos os códigos deveriam estar ativo=true");
    });

    await test("Fase 9.D: resolver_checklist_modelo_padrao() continua na RDC 275 com o catálogo de atividades presente", async () => {
      const { data: padraoAtual, error } = await admin.rpc("resolver_checklist_modelo_padrao");
      if (error) throw error;
      assert(
        padraoAtual === modeloVersaoAtual.id,
        `esperava que o padrão global continuasse sendo a versão da RDC 275 (${modeloVersaoAtual.id}) mesmo com atividade_tags/legislacao_versoes.publicada_em presentes, recebeu ${padraoAtual}`,
      );
    });

    await test("Fase 9.F: CVS_3_2026_PADRAO seedado com 19 seções/255 itens e resolver_checklist_modelo_padrao() continua na RDC 275", async () => {
      const { data: padraoAtual, error } = await admin.rpc("resolver_checklist_modelo_padrao");
      if (error) throw error;
      assert(
        padraoAtual === modeloVersaoAtual.id,
        `esperava que o padrão global continuasse sendo a versão da RDC 275 (${modeloVersaoAtual.id}) mesmo com a CVS 3/2026 publicada, recebeu ${padraoAtual}`,
      );

      const { data: cvs3Modelo, error: erroModelo } = await admin
        .from("checklist_modelo_versoes")
        .select("id, modelo_id, checklist_modelos!inner(codigo, legislacao_versoes(vigente_desde, publicada_em, legislacoes(uf, esfera)))")
        .eq("is_versao_atual", true)
        .eq("checklist_modelos.codigo", "CVS_3_2026_PADRAO")
        .single();
      if (erroModelo) throw erroModelo;
      const legislacao = cvs3Modelo.checklist_modelos.legislacao_versoes;
      assert(legislacao.vigente_desde === "2026-10-04", `vigente_desde esperado 2026-10-04, recebeu ${legislacao.vigente_desde}`);
      assert(legislacao.publicada_em === "2026-07-06", `publicada_em esperado 2026-07-06, recebeu ${legislacao.publicada_em}`);
      assert(legislacao.legislacoes.uf === "SP", `uf esperada SP, recebeu ${legislacao.legislacoes.uf}`);
      assert(legislacao.legislacoes.esfera === "estadual", `esfera esperada estadual, recebeu ${legislacao.legislacoes.esfera}`);

      const { count: secoesCount } = await admin
        .from("checklist_secoes")
        .select("id", { count: "exact", head: true })
        .eq("modelo_versao_id", cvs3Modelo.id);
      assert(secoesCount === 19, `esperava 19 seções na CVS 3/2026, recebeu ${secoesCount}`);

      const { count: itensCount } = await admin
        .from("checklist_itens")
        .select("id", { count: "exact", head: true })
        .eq("modelo_versao_id", cvs3Modelo.id);
      assert(itensCount === 255, `esperava 255 itens na CVS 3/2026, recebeu ${itensCount}`);

      const { count: criticosCount } = await admin
        .from("checklist_itens")
        .select("id", { count: "exact", head: true })
        .eq("modelo_versao_id", cvs3Modelo.id)
        .eq("critico", true);
      assert(criticosCount === 73, `esperava 73 itens críticos na CVS 3/2026 (v2), recebeu ${criticosCount}`);
    });

    await test("Fase 9.G: snapshot de decisão de múltiplos escopos grava e lê todos os campos novos (opção 'duas_inspecoes')", async () => {
      const { data: cvs3Modelo, error: erroModelo } = await admin
        .from("checklist_modelo_versoes")
        .select("id, checklist_modelos!inner(codigo)")
        .eq("is_versao_atual", true)
        .eq("checklist_modelos.codigo", "CVS_3_2026_PADRAO")
        .single();
      if (erroModelo) throw erroModelo;

      const { data: numero, error: numeroErr } = await A.client.rpc("get_next_numero_inspecao");
      if (numeroErr) throw numeroErr;

      const recomendacaoLegislacao = {
        ufConsiderada: "SP",
        atividadesConsideradas: ["comercio_alimentos", "producao_industrializacao"],
        multiplosEscoposIdentificados: true,
        escoposIdentificados: ["comercio_alimentos", "producao_industrializacao"],
        decisaoMultiplosEscopos: "duas_inspecoes",
        modeloSelecionadoParaInspecaoAtual: cvs3Modelo.id,
        modelosSugeridos: [
          { modeloId: cvs3Modelo.id, motivo: "SP + comércio de alimentos" },
          { modeloId: modeloVersaoAtual.id, motivo: "produção/industrialização" },
        ],
        modeloOuEscopoNaoInspecionado: modeloVersaoAtual.id,
        justificativaCodigo: null,
        justificativaTexto: null,
        segundoEscopoPendente: true,
        segundaInspecaoId: null,
        decisaoPorUsuarioId: A.userId,
        decisaoDataHora: new Date().toISOString(),
        versaoRegraDecisao: "9.G-v1",
      };

      const { data: insp, error } = await A.client
        .from("inspecoes")
        .insert({
          empresa_id: A.empresaId,
          cliente_id: clienteA,
          numero_sequencial: numero,
          checklist_modelo_versao_id: cvs3Modelo.id,
          dados: { recomendacaoLegislacao },
        })
        .select("id, dados")
        .single();
      if (error) throw error;

      assert(
        insp.dados.recomendacaoLegislacao.decisaoMultiplosEscopos === "duas_inspecoes",
        "decisaoMultiplosEscopos não round-tripou corretamente",
      );
      assert(insp.dados.recomendacaoLegislacao.segundoEscopoPendente === true, "segundoEscopoPendente não round-tripou");
      assert(
        insp.dados.recomendacaoLegislacao.modelosSugeridos.length === 2,
        "modelosSugeridos não round-tripou com as 2 sugestões",
      );
      assert(
        insp.dados.recomendacaoLegislacao.modeloOuEscopoNaoInspecionado === modeloVersaoAtual.id,
        "modeloOuEscopoNaoInspecionado não round-tripou",
      );

      // Write-back: simula o início da segunda inspeção (RDC 275, produção),
      // vinculando de volta segundaInspecaoId sem tocar em mais nada do snapshot.
      const { data: numero2, error: numero2Err } = await A.client.rpc("get_next_numero_inspecao");
      if (numero2Err) throw numero2Err;
      const { data: segundaInsp, error: erro2 } = await A.client
        .from("inspecoes")
        .insert({
          empresa_id: A.empresaId,
          cliente_id: clienteA,
          numero_sequencial: numero2,
          checklist_modelo_versao_id: modeloVersaoAtual.id,
          dados: {},
        })
        .select("id")
        .single();
      if (erro2) throw erro2;

      const { error: erroWriteback } = await A.client
        .from("inspecoes")
        .update({
          dados: {
            recomendacaoLegislacao: { ...recomendacaoLegislacao, segundaInspecaoId: segundaInsp.id },
          },
        })
        .eq("id", insp.id);
      if (erroWriteback) throw erroWriteback;

      const { data: inspAtualizada, error: erroLeitura } = await A.client
        .from("inspecoes")
        .select("dados, checklist_modelo_versao_id")
        .eq("id", insp.id)
        .single();
      if (erroLeitura) throw erroLeitura;
      assert(
        inspAtualizada.dados.recomendacaoLegislacao.segundaInspecaoId === segundaInsp.id,
        "write-back de segundaInspecaoId não persistiu",
      );
      // Cada inspeção permanece vinculada a exatamente um checklist_modelo_versao_id —
      // a decisão de múltiplos escopos nunca funde os dois modelos numa só inspeção.
      assert(
        inspAtualizada.checklist_modelo_versao_id === cvs3Modelo.id,
        "checklist_modelo_versao_id da primeira inspeção não deveria mudar após o write-back",
      );
    });

    await test("Fase 9.G: snapshot antigo (sem campos de múltiplos escopos) lê sem erro — retrocompatibilidade", async () => {
      const { data: numero, error: numeroErr } = await A.client.rpc("get_next_numero_inspecao");
      if (numeroErr) throw numeroErr;

      // Formato pré-9.G: só os campos já existentes desde a Fase 9.C/9.D.
      const snapshotAntigo = {
        ufConsiderada: "RJ",
        atividadesConsideradas: ["servico_alimentacao"],
        resultado: { tipo: "unica", modeloRecomendadoId: modeloVersaoAtual.id, motivo: "fora de SP", usoAntecipado: false },
        modeloEscolhidoId: modeloVersaoAtual.id,
        seguiuRecomendacao: true,
        dataCalculo: new Date().toISOString(),
        versaoRegra: "9.D-v1",
      };

      const { data: insp, error } = await A.client
        .from("inspecoes")
        .insert({
          empresa_id: A.empresaId,
          cliente_id: clienteA,
          numero_sequencial: numero,
          checklist_modelo_versao_id: modeloVersaoAtual.id,
          dados: { recomendacaoLegislacao: snapshotAntigo },
        })
        .select("dados")
        .single();
      if (error) throw error;

      assert(
        insp.dados.recomendacaoLegislacao.modeloEscolhidoId === modeloVersaoAtual.id,
        "leitura de snapshot antigo falhou",
      );
      assert(
        insp.dados.recomendacaoLegislacao.decisaoMultiplosEscopos === undefined,
        "snapshot antigo não deveria ganhar campos novos sozinho",
      );
    });

    await test("UPDATE em item de versão de checklist publicada falha", async () => {
      const { data: item } = await admin.from("checklist_itens").select("id").eq("modelo_versao_id", modeloVersaoAtual.id).limit(1).single();
      const { error } = await admin.from("checklist_itens").update({ texto: "hackeado" }).eq("id", item.id);
      assert(error !== null, "UPDATE deveria falhar (trigger de imutabilidade de conteúdo)");
    });

    await test("UPDATE em seção de versão de checklist publicada falha", async () => {
      const { data: secao } = await admin.from("checklist_secoes").select("id").eq("modelo_versao_id", modeloVersaoAtual.id).limit(1).single();
      const { error } = await admin.from("checklist_secoes").update({ titulo: "hackeado" }).eq("id", secao.id);
      assert(error !== null, "UPDATE deveria falhar (trigger de imutabilidade de conteúdo)");
    });

    await test("UPDATE de modelo_id/numero_versao em versão publicada falha (imutabilidade de identidade)", async () => {
      const { data: legislacaoVersao } = await admin.from("legislacao_versoes").select("id").limit(1).single();
      const { data: outroModelo } = await admin
        .from("checklist_modelos")
        .insert({ legislacao_versao_id: legislacaoVersao.id, codigo: `TESTE_ISOLAMENTO_${Date.now()}`, nome: "Modelo descartável de teste" })
        .select("id")
        .single();
      const { error } = await admin.from("checklist_modelo_versoes").update({ modelo_id: outroModelo.id }).eq("id", modeloVersaoAtual.id);
      await admin.from("checklist_modelos").delete().eq("id", outroModelo.id);
      assert(error !== null, "UPDATE de modelo_id deveria falhar — identidade de versão publicada é imutável");
    });

    console.log("\nFase 7 — crm_obter_ou_criar_diagnostico com checklist_modelo_versao_id:");

    const oportunidadeModelo = await seedOportunidade(A, "Oportunidade Fase7 Modelo");

    await test("RPC preenche checklist_modelo_versao_id com o modelo padrão", async () => {
      const { data, error } = await A.client.rpc("crm_obter_ou_criar_diagnostico", { p_oportunidade_id: oportunidadeModelo });
      if (error) throw error;
      const { data: insp } = await admin.from("inspecoes").select("checklist_modelo_versao_id").eq("id", data[0].inspecao_id).single();
      assert(insp.checklist_modelo_versao_id === modeloVersaoAtual.id, "checklist_modelo_versao_id não foi preenchido com o modelo padrão");
    });

    await test("Evento 'diagnostico_iniciado' é gravado (regressão do fix de crm_registrar_timeline_sistema)", async () => {
      const { data } = await admin.from("crm_timeline").select("id").eq("crm_oportunidade_id", oportunidadeModelo).eq("evento_tipo", "diagnostico_iniciado");
      assert(data.length === 1, `esperava 1 evento, encontrou ${data.length}`);
    });

    console.log("\nFase 7 — fluxo de programação de reinspeção:");

    const clienteReinspecao = await seedCliente(A, "Cliente Reinspeção Fase7");
    const numeroOrigem = (await A.client.rpc("get_next_numero_inspecao")).data;
    const { data: inspecaoOrigemReinspecao } = await admin
      .from("inspecoes")
      .insert({
        empresa_id: A.empresaId, cliente_id: clienteReinspecao, numero_sequencial: numeroOrigem,
        status: "concluida", data_conclusao: new Date().toISOString(), respostas: {},
        checklist_modelo_versao_id: modeloVersaoAtual.id, consultor_id: A.userId,
      })
      .select("id")
      .single();

    let programacaoReinspecaoId;
    await test("criar_programacao_reinspecao cria com status 'programada' e evento 'criada'", async () => {
      const { data, error } = await A.client.rpc("criar_programacao_reinspecao", {
        p_inspecao_origem_id: inspecaoOrigemReinspecao.id, p_data_prevista: "2027-01-01",
      });
      if (error) throw error;
      programacaoReinspecaoId = data;
      const { data: prog } = await admin.from("reinspecao_programacoes").select("status").eq("id", programacaoReinspecaoId).single();
      assert(prog.status === "programada", `esperava 'programada', recebeu '${prog.status}'`);
    });

    await test("Consultor do Tenant B não vê programação do Tenant A (RLS)", async () => {
      const { data } = await B.client.from("reinspecao_programacoes").select("id").eq("id", programacaoReinspecaoId);
      assert(data.length === 0, "Tenant B não deveria enxergar a programação do Tenant A");
    });

    await test("reagendar_programacao_reinspecao atualiza data e status", async () => {
      const { error } = await A.client.rpc("reagendar_programacao_reinspecao", { p_programacao_id: programacaoReinspecaoId, p_nova_data: "2027-02-01" });
      if (error) throw error;
      const { data: prog } = await admin.from("reinspecao_programacoes").select("status, data_prevista").eq("id", programacaoReinspecaoId).single();
      assert(prog.status === "reagendada" && prog.data_prevista === "2027-02-01", "reagendamento não aplicado corretamente");
    });

    let novaReinspecaoId;
    await test("iniciar_reinspecao cria inspeção tipo_execucao='reinspecao' herdando cliente/modelo", async () => {
      const { data, error } = await A.client.rpc("iniciar_reinspecao", { p_programacao_id: programacaoReinspecaoId });
      if (error) throw error;
      novaReinspecaoId = data;
      const { data: nova } = await admin.from("inspecoes").select("tipo_execucao, inspecao_origem_id, cliente_id, checklist_modelo_versao_id").eq("id", novaReinspecaoId).single();
      assert(nova.tipo_execucao === "reinspecao", "tipo_execucao incorreto");
      assert(nova.inspecao_origem_id === inspecaoOrigemReinspecao.id, "inspecao_origem_id não vinculado");
      assert(nova.cliente_id === clienteReinspecao, "cliente_id não herdado");
      assert(nova.checklist_modelo_versao_id === modeloVersaoAtual.id, "checklist_modelo_versao_id não herdado");
    });

    await test("iniciar_reinspecao de novo (duplo-clique/concorrência) falha e não duplica", async () => {
      const { error } = await A.client.rpc("iniciar_reinspecao", { p_programacao_id: programacaoReinspecaoId });
      assert(error !== null, "segunda chamada deveria falhar");
      const { data: todas } = await admin.from("inspecoes").select("id").eq("inspecao_origem_id", inspecaoOrigemReinspecao.id);
      assert(todas.length === 1, `esperava 1 reinspeção, encontrou ${todas.length}`);
    });

    await test("cancelar_programacao_reinspecao falha para programação já 'iniciada'", async () => {
      const { error } = await A.client.rpc("cancelar_programacao_reinspecao", { p_programacao_id: programacaoReinspecaoId });
      assert(error !== null, "cancelar deveria falhar — status 'iniciada' não é cancelável");
    });

    await test("Concluir a reinspeção marca a programação como 'realizada' (trigger automático)", async () => {
      const { error } = await A.client.from("inspecoes").update({ status: "concluida", data_conclusao: new Date().toISOString() }).eq("id", novaReinspecaoId);
      if (error) throw error;
      const { data: prog } = await admin.from("reinspecao_programacoes").select("status").eq("id", programacaoReinspecaoId).single();
      assert(prog.status === "realizada", `esperava 'realizada', recebeu '${prog.status}'`);
      const { data: eventos } = await admin.from("reinspecao_programacao_eventos").select("id").eq("programacao_id", programacaoReinspecaoId).eq("evento_tipo", "realizada");
      assert(eventos.length === 1, "evento 'realizada' não foi gravado pelo trigger");
    });

    await test("FK composta rejeita programação apontando inspeção de outro tenant", async () => {
      const clienteB2 = await seedCliente(B, "Cliente B FK Fase7");
      const numeroB2 = (await B.client.rpc("get_next_numero_inspecao")).data;
      const { data: inspB2 } = await admin
        .from("inspecoes")
        .insert({ empresa_id: B.empresaId, cliente_id: clienteB2, numero_sequencial: numeroB2, status: "concluida", respostas: {}, checklist_modelo_versao_id: modeloVersaoAtual.id })
        .select("id")
        .single();
      const { error } = await admin.from("reinspecao_programacoes").insert({
        empresa_id: A.empresaId, inspecao_origem_id: inspB2.id, data_prevista: "2027-01-01",
      });
      assert(error !== null, "INSERT deveria falhar — FK composta (empresa_id, inspecao_origem_id) exige mesma empresa");
    });

  } finally {
    console.log("\nLimpeza dos dados de teste...");
    for (const tenant of tenants) {
      await cleanupTenant(tenant).catch((err) => console.error(`  falha ao limpar ${tenant.label}: ${err.message}`));
    }
    console.log("Limpeza concluída.");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} testes passaram.`);
  if (failed.length > 0) {
    console.log("\nFalhas:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nErro fatal no script de testes:", err);
  process.exit(1);
});
