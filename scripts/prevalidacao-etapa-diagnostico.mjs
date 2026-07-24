// Fase 5 (Diagnóstico no CRM) — pré-validação read-only, roda contra staging.
// Não escreve nada. Aborta se a connection string apontar para produção.
import pg from "pg";

const STAGING_HOST = "db.xqjvkevesrmkbtbvtzhk.supabase.co";
const PRODUCTION_HOST = "db.nvkfgczahyxzgoomkavk.supabase.co";

const host = process.env.DB_HOST || STAGING_HOST;
if (host.includes("nvkfgczahyxzgoomkavk") || host === PRODUCTION_HOST) {
  console.error("BLOQUEADO: este script não roda contra o host de produção.");
  process.exit(1);
}

const client = new pg.Client({
  host,
  port: 5432,
  user: "postgres",
  password: process.env.DB_PASS,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  await client.connect();
  console.log("Conectado a:", host);

  section("1. Pipelines com mais de uma etapa gera_diagnostico=true");
  const duplicadas = await client.query(
    `SELECT pipeline_id, count(*)::int AS qtd_marcadas
     FROM public.crm_etapas
     WHERE gera_diagnostico = true
     GROUP BY pipeline_id
     HAVING count(*) > 1`
  );
  console.log(`Encontrados: ${duplicadas.rowCount}`);
  if (duplicadas.rowCount > 0) console.table(duplicadas.rows);

  section("2. Etapas gera_diagnostico=true fora de tipo='aberta'");
  const foraDeAberta = await client.query(
    `SELECT id, pipeline_id, nome, tipo
     FROM public.crm_etapas
     WHERE gera_diagnostico = true AND tipo <> 'aberta'`
  );
  console.log(`Encontrados: ${foraDeAberta.rowCount}`);
  if (foraDeAberta.rowCount > 0) console.table(foraDeAberta.rows);

  section("3. Colisão de nomes de constraint/índice novos");
  const NEW_NAMES = ["crm_etapas_pipeline_diagnostico_unique", "crm_etapas_diagnostico_somente_aberta_check"];
  const colisoes = await client.query(
    `SELECT conname, conrelid::regclass::text AS tabela FROM pg_constraint WHERE conname = ANY($1)
     UNION ALL
     SELECT indexname AS conname, tablename AS tabela FROM pg_indexes WHERE indexname = ANY($1)`,
    [NEW_NAMES]
  );
  console.log(`Colisões encontradas: ${colisoes.rowCount}`);
  if (colisoes.rowCount > 0) console.table(colisoes.rows);

  section("RESUMO / CRITÉRIO DE PARADA");
  const bloqueadores = [];
  if (duplicadas.rowCount > 0) bloqueadores.push(`${duplicadas.rowCount} pipeline(s) com múltiplas etapas marcadas`);
  if (foraDeAberta.rowCount > 0) bloqueadores.push(`${foraDeAberta.rowCount} etapa(s) marcada(s) fora de tipo='aberta'`);
  if (colisoes.rowCount > 0) bloqueadores.push(`${colisoes.rowCount} colisão(ões) de nome`);

  if (bloqueadores.length > 0) {
    console.log("BLOQUEADO — encontrados problemas que exigem decisão antes da migration:");
    bloqueadores.forEach((b) => console.log(" - " + b));
    process.exitCode = 1;
  } else {
    console.log("Nenhum bloqueador encontrado. Seguro aplicar o índice único e a CHECK constraint.");
  }
}

main()
  .catch((err) => {
    console.error("ERRO:", err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
