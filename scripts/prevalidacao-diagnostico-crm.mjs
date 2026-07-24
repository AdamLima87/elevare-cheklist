// Fase 2/3 (Diagnóstico no CRM) — pré-validação read-only, roda contra staging.
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

const NEW_CONSTRAINT_NAMES = [
  "inspecoes_crm_oportunidade_empresa_fkey",
  "inspecoes_tipo_execucao_check",
  "inspecoes_tem_origem_check",
  "inspecoes_empresa_crm_oportunidade_idx",
  "inspecoes_empresa_cliente_tipo_idx",
  "crm_etapas_gera_diagnostico",
  // Fase 3
  "can_access_crm",
  "inspecoes_diagnostico_select",
  "inspecoes_diagnostico_insert",
  "inspecoes_diagnostico_update",
  "inspecoes_diagnostico_tem_oportunidade_check",
];

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  await client.connect();
  console.log("Conectado a:", host);

  section("1. Total de inspecoes");
  const total = await client.query(`SELECT count(*)::int AS total FROM inspecoes`);
  console.log(total.rows[0]);

  section("2. Distribuição por empresa_id");
  const porEmpresa = await client.query(
    `SELECT empresa_id, count(*)::int AS total FROM inspecoes GROUP BY empresa_id ORDER BY 2 DESC`
  );
  console.table(porEmpresa.rows);

  section("3. cliente_id nulo vs preenchido");
  const clienteNulo = await client.query(
    `SELECT count(*) FILTER (WHERE cliente_id IS NULL)::int AS nulo,
            count(*) FILTER (WHERE cliente_id IS NOT NULL)::int AS preenchido
     FROM inspecoes`
  );
  console.log(clienteNulo.rows[0]);

  section("4. cliente_id órfão (aponta pra cliente inexistente)");
  const orfaos = await client.query(
    `SELECT i.id, i.empresa_id, i.cliente_id
     FROM inspecoes i
     LEFT JOIN clientes c ON c.id = i.cliente_id
     WHERE i.cliente_id IS NOT NULL AND c.id IS NULL`
  );
  console.log(`Encontrados: ${orfaos.rowCount}`);
  if (orfaos.rowCount > 0) console.table(orfaos.rows);

  section("5. empresa_id divergente entre inspecao e cliente");
  const divergentes = await client.query(
    `SELECT i.id, i.empresa_id AS empresa_inspecao, c.empresa_id AS empresa_cliente, i.cliente_id
     FROM inspecoes i
     JOIN clientes c ON c.id = i.cliente_id
     WHERE i.empresa_id <> c.empresa_id`
  );
  console.log(`Encontrados: ${divergentes.rowCount}`);
  if (divergentes.rowCount > 0) console.table(divergentes.rows);

  section("6. Inspeções por cliente (informativo, sem classificar nada)");
  const porCliente = await client.query(
    `SELECT cliente_id, count(*)::int AS total
     FROM inspecoes
     WHERE cliente_id IS NOT NULL
     GROUP BY cliente_id
     ORDER BY 2 DESC
     LIMIT 20`
  );
  console.table(porCliente.rows);
  console.log(
    "Nota: nenhum registro será classificado automaticamente como 'reinspecao'/'diagnostico'. " +
      "Todos os registros existentes recebem 'inspecao_legada', por decisão de produto (Fase 1/2)."
  );

  section("8. Total de crm_oportunidades");
  const totalOportunidades = await client.query(`SELECT count(*)::int AS total FROM crm_oportunidades`);
  console.log(totalOportunidades.rows[0]);

  section("9. Pipelines/etapas por tenant");
  const etapas = await client.query(
    `SELECT ce.empresa_id, cp.nome AS pipeline, ce.nome AS etapa, ce.tipo, ce.ordem
     FROM crm_etapas ce
     JOIN crm_pipelines cp ON cp.id = ce.pipeline_id
     ORDER BY ce.empresa_id, cp.nome, ce.ordem`
  );
  console.table(etapas.rows);

  section("10. Colisão de nomes de constraint/índice novos");
  const colisoes = await client.query(
    `SELECT conname, conrelid::regclass::text AS tabela FROM pg_constraint WHERE conname = ANY($1)
     UNION ALL
     SELECT indexname AS conname, tablename AS tabela FROM pg_indexes WHERE indexname = ANY($1)`,
    [NEW_CONSTRAINT_NAMES]
  );
  console.log(`Colisões encontradas: ${colisoes.rowCount}`);
  if (colisoes.rowCount > 0) console.table(colisoes.rows);

  section("11. Índices atuais em inspecoes e crm_etapas");
  const indices = await client.query(
    `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE tablename IN ('inspecoes','crm_etapas') ORDER BY tablename, indexname`
  );
  console.table(indices.rows.map((r) => ({ tabela: r.tablename, indice: r.indexname })));

  section("12. Registros que violariam inspecoes_tem_origem_check (cliente_id E crm_oportunidade_id nulos)");
  const semOrigem = await client.query(
    `SELECT id, empresa_id FROM inspecoes WHERE cliente_id IS NULL AND crm_oportunidade_id IS NULL`
  );
  console.log(`Encontrados: ${semOrigem.rowCount}`);
  if (semOrigem.rowCount > 0) console.table(semOrigem.rows);

  section("13. Registros que violariam inspecoes_diagnostico_tem_oportunidade_check (diagnostico sem oportunidade)");
  const diagnosticoSemOportunidade = await client.query(
    `SELECT id, empresa_id, cliente_id FROM inspecoes WHERE tipo_execucao = 'diagnostico' AND crm_oportunidade_id IS NULL`
  );
  console.log(`Encontrados: ${diagnosticoSemOportunidade.rowCount}`);
  if (diagnosticoSemOportunidade.rowCount > 0) console.table(diagnosticoSemOportunidade.rows);

  section("14. Diagnósticos duplicados por oportunidade (Fase 4 — pré-requisito do índice único)");
  const diagnosticosDuplicados = await client.query(
    `SELECT empresa_id, crm_oportunidade_id, count(*)::int AS total
     FROM inspecoes
     WHERE tipo_execucao = 'diagnostico'
     GROUP BY empresa_id, crm_oportunidade_id
     HAVING count(*) > 1`
  );
  console.log(`Encontrados: ${diagnosticosDuplicados.rowCount}`);
  if (diagnosticosDuplicados.rowCount > 0) console.table(diagnosticosDuplicados.rows);

  section("RESUMO / CRITÉRIO DE PARADA");
  const bloqueadores = [];
  if (orfaos.rowCount > 0) bloqueadores.push(`${orfaos.rowCount} inspeção(ões) com cliente_id órfão`);
  if (divergentes.rowCount > 0) bloqueadores.push(`${divergentes.rowCount} inspeção(ões) com empresa_id divergente`);
  if (colisoes.rowCount > 0) bloqueadores.push(`${colisoes.rowCount} colisão(ões) de nome de constraint/índice`);
  if (diagnosticosDuplicados.rowCount > 0)
    bloqueadores.push(`${diagnosticosDuplicados.rowCount} oportunidade(s) com mais de um diagnóstico`);

  if (bloqueadores.length > 0) {
    console.log("BLOQUEADO — encontrados problemas que exigem decisão antes da migration:");
    bloqueadores.forEach((b) => console.log(" - " + b));
    process.exitCode = 1;
  } else {
    console.log("Nenhum bloqueador crítico encontrado.");
  }

  console.log(
    `\ninspecoes_tem_origem_check: ${semOrigem.rowCount === 0 ? "SEGURO VALIDAR (0 violações)" : `NÃO VALIDAR (${semOrigem.rowCount} violação(ões))`}`
  );
  console.log(
    `inspecoes_diagnostico_tem_oportunidade_check: ${diagnosticoSemOportunidade.rowCount === 0 ? "SEGURO VALIDAR (0 violações)" : `NÃO VALIDAR (${diagnosticoSemOportunidade.rowCount} violação(ões))`}`
  );
}

main()
  .catch((err) => {
    console.error("ERRO:", err);
    process.exitCode = 1;
  })
  .finally(() => client.end());
