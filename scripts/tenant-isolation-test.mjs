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

    const oportunidadeConv = await seedOportunidade(A, "Oportunidade Conversão");
    const diagConv1 = await seedDiagnostico(A, oportunidadeConv);
    const diagConv2 = await seedDiagnostico(A, oportunidadeConv);

    let clienteConvId;
    await test("Fechamento normal: cria cliente e vincula os 2 diagnósticos da oportunidade", async () => {
      const { data, error } = await A.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeConv });
      if (error) throw error;
      const r = data[0];
      assert(r.cliente_criado === true, "esperava cliente_criado=true");
      assert(r.already_converted === false, "esperava already_converted=false na 1ª chamada");
      assert(r.diagnosticos_vinculados === 2, `esperava 2 diagnósticos vinculados, recebeu ${r.diagnosticos_vinculados}`);
      clienteConvId = r.cliente_id;
      const { data: d1 } = await admin.from("inspecoes").select("cliente_id, crm_oportunidade_id").eq("id", diagConv1).single();
      assert(d1.cliente_id === clienteConvId, "diagnóstico 1 não foi vinculado ao cliente certo");
      assert(d1.crm_oportunidade_id === oportunidadeConv, "diagnóstico 1 perdeu crm_oportunidade_id na conversão");
      const { data: d2 } = await admin.from("inspecoes").select("cliente_id").eq("id", diagConv2).single();
      assert(d2.cliente_id === clienteConvId, "diagnóstico 2 não foi vinculado ao cliente certo");
    });

    await test("Segunda chamada é idempotente: already_converted=true, sem nova escrita", async () => {
      const before = await admin.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", A.empresaId);
      const { data, error } = await A.client.rpc("crm_fechar_oportunidade_ganha", { p_oportunidade_id: oportunidadeConv });
      if (error) throw error;
      const r = data[0];
      assert(r.already_converted === true, "esperava already_converted=true na 2ª chamada");
      assert(r.cliente_criado === false, "esperava cliente_criado=false na 2ª chamada");
      assert(r.cliente_id === clienteConvId, "cliente_id mudou entre chamadas");
      assert(r.diagnosticos_vinculados === 2, `esperava 2, recebeu ${r.diagnosticos_vinculados}`);
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
