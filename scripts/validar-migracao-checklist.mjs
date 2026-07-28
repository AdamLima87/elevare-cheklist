// Fase 8.B — generaliza scripts/validar-migracao-checklist-rdc275.mjs
// (Fase 7.2) para validar QUALQUER modelo, não só RDC_275_2002_PADRAO.
// Valida que o conteúdo semeado no banco (checklist_secoes/checklist_itens
// da versão "atual" do modelo) é EXATAMENTE equivalente ao módulo de dados
// TS informado: mesmas seções, mesma ordem, mesmos itens, mesmo texto,
// mesmo `critico`.
//
// uso: node scripts/validar-migracao-checklist.mjs <MODELO_CODIGO> <caminho/dados.ts> [caminho/para/.env.staging]
// ex.: node scripts/validar-migracao-checklist.mjs RDC_275_2002_PADRAO ./src/lib/checklist-data.ts
//      node scripts/validar-migracao-checklist.mjs RDC_216_2004_PADRAO ./src/lib/checklist-data-rdc216.ts

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";

const PRODUCTION_REF = "nvkfgczahyxzgoomkavk";

function loadEnvFile(filePath) {
  const env = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const modeloCodigo = process.argv[2];
const dadosArg = process.argv[3];
const envPath = process.argv[4] || ".env.staging";

if (!modeloCodigo || !dadosArg) {
  console.error("Uso: node scripts/validar-migracao-checklist.mjs <MODELO_CODIGO> <caminho/dados.ts> [.env.staging]");
  process.exit(1);
}

const env = loadEnvFile(envPath);
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error(`Faltam VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em ${envPath}.`);
  process.exit(1);
}
if (supabaseUrl.includes(PRODUCTION_REF)) {
  console.error("Este script não roda contra produção — aponte para staging.");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const dadosUrl = "file:///" + path.resolve(process.cwd(), dadosArg).replace(/\\/g, "/").replace(/ /g, "%20");
const { checklistSections } = await import(dadosUrl);

let falhas = 0;
function assertEqual(label, esperado, recebido) {
  if (esperado !== recebido) {
    falhas++;
    console.error(`FALHA [${label}]: esperado=${JSON.stringify(esperado)} recebido=${JSON.stringify(recebido)}`);
  }
}

const { data: modelo, error: modeloErr } = await supabase
  .from("checklist_modelos")
  .select("id")
  .eq("codigo", modeloCodigo)
  .single();
if (modeloErr || !modelo) {
  console.error(`Modelo ${modeloCodigo} não encontrado:`, modeloErr?.message);
  process.exit(1);
}

const { data: modeloVersao, error: versaoErr } = await supabase
  .from("checklist_modelo_versoes")
  .select("id, publicado_em")
  .eq("modelo_id", modelo.id)
  .eq("is_versao_atual", true)
  .single();
if (versaoErr || !modeloVersao) {
  console.error("Versão atual do modelo não encontrada:", versaoErr?.message);
  process.exit(1);
}
if (!modeloVersao.publicado_em) {
  console.error("Versão atual não está publicada — seed incompleto.");
  process.exit(1);
}

const { data: secoesDb } = await supabase
  .from("checklist_secoes")
  .select("id, secao_key, titulo, ordem")
  .eq("modelo_versao_id", modeloVersao.id)
  .order("ordem");
const { data: itensDb } = await supabase
  .from("checklist_itens")
  .select("secao_id, item_key, texto, critico, ordem")
  .eq("modelo_versao_id", modeloVersao.id)
  .order("ordem");

assertEqual("total de seções", checklistSections.length, secoesDb.length);

const secaoIdPorKey = new Map(secoesDb.map((s) => [s.secao_key, s.id]));

let ordemGlobalEsperada = 0;
const itensDbPorOrdem = itensDb;
let idxItemDb = 0;

checklistSections.forEach((secao, idxSecao) => {
  const secaoDb = secoesDb[idxSecao];
  if (!secaoDb) {
    falhas++;
    console.error(`FALHA: seção "${secao.id}" ausente no banco na posição ${idxSecao}`);
    return;
  }
  assertEqual(`secao[${idxSecao}].secao_key`, secao.id, secaoDb.secao_key);
  assertEqual(`secao[${idxSecao}].titulo`, secao.title, secaoDb.titulo);

  secao.items.forEach((item) => {
    ordemGlobalEsperada++;
    const itemDb = itensDbPorOrdem[idxItemDb];
    idxItemDb++;
    if (!itemDb) {
      falhas++;
      console.error(`FALHA: item "${item.id}" (seção ${secao.id}) ausente no banco na ordem ${ordemGlobalEsperada}`);
      return;
    }
    assertEqual(`item[ordem=${ordemGlobalEsperada}].item_key`, item.id, itemDb.item_key);
    assertEqual(`item[ordem=${ordemGlobalEsperada}].texto`, item.text, itemDb.texto);
    assertEqual(`item[ordem=${ordemGlobalEsperada}].critico`, !!item.critico, itemDb.critico);
    assertEqual(`item[ordem=${ordemGlobalEsperada}].secao_id`, secaoIdPorKey.get(secao.id), itemDb.secao_id);
  });
});

const totalItensEsperado = checklistSections.reduce((acc, s) => acc + s.items.length, 0);
assertEqual("total de itens", totalItensEsperado, itensDb.length);

if (falhas > 0) {
  console.error(`\n${falhas} divergência(s) encontrada(s) entre ${dadosArg} e o banco.`);
  process.exit(1);
}
console.log(`OK — ${checklistSections.length} seções e ${totalItensEsperado} itens equivalentes entre ${dadosArg} (${modeloCodigo}) e o banco.`);
