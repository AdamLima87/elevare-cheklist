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

async function cleanupTenant(tenant) {
  const empresaId = tenant.empresaId;
  for (const table of ["documentos", "visitas", "cliente_interacoes", "inspecoes", "clientes", "configuracoes", "numeracao_inspecoes"]) {
    await admin.from(table).delete().eq("empresa_id", empresaId);
  }
  for (const userId of tenant.userIds) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  await admin.from("empresas").delete().eq("id", empresaId);
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
