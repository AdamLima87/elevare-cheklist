// Fase 7.2 — gera a migration SQL de seed da RDC 275/2002 a partir do
// conteúdo hoje hardcoded em src/lib/checklist-data.ts. UUIDs são
// determinísticos (UUIDv5 sobre um namespace fixo + a chave natural de cada
// registro), então rodar este script de novo sempre produz os MESMOS ids —
// a migration gerada é reprodutível, não aleatória a cada execução.
//
// Uso: node scripts/gerar-seed-checklist-rdc275.mjs > supabase/migrations/<timestamp>_checklist_legislacoes_seed_rdc275.sql

import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const checklistDataUrl =
  "file:///" + path.resolve(__dirname, "../src/lib/checklist-data.ts").replace(/\\/g, "/").replace(/ /g, "%20");

const { checklistSections } = await import(checklistDataUrl);

const NAMESPACE = "6f2c6f8e-rdcheck-fase7-checklist-seed"; // string fixa, não um uuid real — só entra no hash

function uuidv5(name) {
  const hash = createHash("sha1").update(NAMESPACE + ":" + name).digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // versão 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const legislacaoId = uuidv5("legislacao:RDC_275_2002");
const legislacaoVersaoId = uuidv5("legislacao_versao:RDC_275_2002:1");
const modeloId = uuidv5("checklist_modelo:RDC_275_2002_PADRAO");
const modeloVersaoId = uuidv5("checklist_modelo_versao:RDC_275_2002_PADRAO:1");

const lines = [];
lines.push(
  "-- Fase 7.2 — seed determinístico da RDC 275/2002 (migração do conteúdo",
  "-- hardcoded em src/lib/checklist-data.ts pra estrutura de banco da Fase 7.1).",
  "-- Gerado por scripts/gerar-seed-checklist-rdc275.mjs — não editar à mão;",
  "-- se o conteúdo do checklist mudar, rode o script de novo e substitua",
  "-- este arquivo por uma NOVA migration (esta versão, uma vez publicada,",
  "-- é imutável por construção — ver trigger da Fase 7.1).",
  "-- UUIDs são determinísticos (UUIDv5 sobre a chave natural de cada",
  "-- registro) — ON CONFLICT DO NOTHING torna esta migration idempotente.",
  "",
  `INSERT INTO public.legislacoes (id, codigo, nome, esfera, uf, ativo) VALUES`,
  `  (${sqlLiteral(legislacaoId)}, 'RDC_275_2002', 'RDC nº 275/2002 - ANVISA', 'federal', NULL, true)`,
  `ON CONFLICT (codigo) DO NOTHING;`,
  "",
  `INSERT INTO public.legislacao_versoes (id, legislacao_id, numero_versao, descricao, vigente_desde, ativo) VALUES`,
  `  (${sqlLiteral(legislacaoVersaoId)}, ${sqlLiteral(legislacaoId)}, 1, 'Texto original da RDC 275/2002', NULL, true)`,
  `ON CONFLICT (legislacao_id, numero_versao) DO NOTHING;`,
  "",
  `INSERT INTO public.checklist_modelos (id, legislacao_versao_id, codigo, nome, ativo) VALUES`,
  `  (${sqlLiteral(modeloId)}, ${sqlLiteral(legislacaoVersaoId)}, 'RDC_275_2002_PADRAO', 'Checklist RDC 275/2002 - Padrão RDCheck', true)`,
  `ON CONFLICT (codigo) DO NOTHING;`,
  "",
  `INSERT INTO public.checklist_modelo_versoes (id, modelo_id, numero_versao, is_versao_atual, publicado_em, ativo) VALUES`,
  `  (${sqlLiteral(modeloVersaoId)}, ${sqlLiteral(modeloId)}, 1, true, now(), true)`,
  `ON CONFLICT (modelo_id, numero_versao) DO NOTHING;`,
  "",
);

lines.push("INSERT INTO public.checklist_secoes (id, modelo_versao_id, secao_key, titulo, ordem) VALUES");
const secaoRows = checklistSections.map((secao, idx) => {
  const id = uuidv5(`checklist_secao:${modeloVersaoId}:${secao.id}`);
  return `  (${sqlLiteral(id)}, ${sqlLiteral(modeloVersaoId)}, ${sqlLiteral(secao.id)}, ${sqlLiteral(secao.title)}, ${idx + 1})`;
});
lines.push(secaoRows.join(",\n") + "\nON CONFLICT (modelo_versao_id, secao_key) DO NOTHING;");
lines.push("");

lines.push(
  "INSERT INTO public.checklist_itens (id, modelo_versao_id, secao_id, item_key, texto, critico, ordem) VALUES",
);
const itemRows = [];
let ordemGlobal = 0;
checklistSections.forEach((secao) => {
  const secaoId = uuidv5(`checklist_secao:${modeloVersaoId}:${secao.id}`);
  secao.items.forEach((item) => {
    ordemGlobal += 1;
    const id = uuidv5(`checklist_item:${modeloVersaoId}:${item.id}`);
    itemRows.push(
      `  (${sqlLiteral(id)}, ${sqlLiteral(modeloVersaoId)}, ${sqlLiteral(secaoId)}, ${sqlLiteral(item.id)}, ${sqlLiteral(item.text)}, ${item.critico ? "true" : "false"}, ${ordemGlobal})`,
    );
  });
});
lines.push(itemRows.join(",\n") + "\nON CONFLICT (modelo_versao_id, item_key) DO NOTHING;");
lines.push("");

lines.push(
  "-- Função de resolução do modelo padrão — hoje trivial (só existe RDC 275),",
  "-- mas é o ponto de extensão deliberado: a Fase 9 substitui só o CORPO desta",
  "-- função por uma regra de estado + tipo de estabelecimento, sem exigir",
  "-- nenhuma mudança nos call sites (crm_obter_ou_criar_diagnostico,",
  "-- createNewInspecao, backfill de inspecoes).",
  "CREATE OR REPLACE FUNCTION public.resolver_checklist_modelo_padrao()",
  "RETURNS uuid",
  "LANGUAGE sql",
  "STABLE",
  "SET search_path = 'public'",
  "AS $function$",
  `  SELECT id FROM public.checklist_modelo_versoes WHERE modelo_id = ${sqlLiteral(modeloId)} AND is_versao_atual = true LIMIT 1;`,
  "$function$;",
  "",
  `-- id fixo para uso no backfill de inspecoes (migration seguinte): ${modeloVersaoId}`,
);

process.stdout.write(lines.join("\n") + "\n");
