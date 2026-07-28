// Fase 8.B — generaliza scripts/gerar-seed-checklist-rdc275.mjs (Fase 7.2)
// para gerar o seed de QUALQUER modelo de checklist, não só a RDC 275.
// UUIDs continuam determinísticos (UUIDv5 sobre o MESMO namespace da Fase 7),
// então o mesmo conjunto de argumentos sempre produz os mesmos ids.
//
// Uso:
//   node scripts/gerar-seed-checklist.mjs \
//     --codigo=RDC_216_2004 \
//     --nome="RDC nº 216/2004 - ANVISA" \
//     --versao-descricao="Texto original da RDC 216/2004" \
//     --modelo-codigo=RDC_216_2004_PADRAO \
//     --modelo-nome="Checklist RDC 216/2004 - Padrão RDCheck" \
//     --modelo-descricao="Boas Práticas para Serviços de Alimentação." \
//     --dados=./src/lib/checklist-data-rdc216.ts \
//     --sem-resolver \
//     > supabase/migrations/<timestamp>_checklist_legislacoes_seed_rdc216.sql
//
// --sem-resolver OMITE o bloco CREATE OR REPLACE resolver_checklist_modelo_padrao()
// da saída — obrigatório para qualquer legislação que não deva virar o padrão
// global (ver Fase 8.B.2: cadastrar uma legislação nunca pode trocá-lo
// silenciosamente).
//
// Guard de regressão (Fase 8.B): rodar SEM --modelo-descricao e com os
// defaults da RDC 275 abaixo deve reproduzir byte-a-byte a migration
// 20260808100100_checklist_legislacoes_seed_rdc275.sql já aplicada — a
// coluna checklist_modelos.descricao só existe desde a Fase 8.B
// (20260809100000), então a INSERT original da 275 nunca a teve.

import { createHash } from "node:crypto";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq === -1) args[raw.slice(2)] = true;
    else args[raw.slice(2, eq)] = raw.slice(eq + 1);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const codigo = args.codigo ?? "RDC_275_2002";
const nome = args.nome ?? "RDC nº 275/2002 - ANVISA";
const esfera = args.esfera ?? "federal";
const uf = args.uf ?? null;
const versaoDescricao = args["versao-descricao"] ?? "Texto original da RDC 275/2002";
const vigenteDesde = args["vigente-desde"] ?? null;
const modeloCodigo = args["modelo-codigo"] ?? "RDC_275_2002_PADRAO";
const modeloNome = args["modelo-nome"] ?? "Checklist RDC 275/2002 - Padrão RDCheck";
const modeloDescricao = args["modelo-descricao"] ?? null; // omitido = coluna não entra na INSERT (guard de regressão da 275)
const dadosPath = args.dados ?? "./src/lib/checklist-data.ts";
const semResolver = args["sem-resolver"] === true;

const dadosUrl =
  "file:///" + path.resolve(process.cwd(), dadosPath).replace(/\\/g, "/").replace(/ /g, "%20");

const { checklistSections } = await import(dadosUrl);

const NAMESPACE = "6f2c6f8e-rdcheck-fase7-checklist-seed"; // string fixa — mesmo namespace desde a Fase 7, não trocar

function uuidv5(name) {
  const hash = createHash("sha1").update(NAMESPACE + ":" + name).digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // versão 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

const legislacaoId = uuidv5(`legislacao:${codigo}`);
const legislacaoVersaoId = uuidv5(`legislacao_versao:${codigo}:1`);
const modeloId = uuidv5(`checklist_modelo:${modeloCodigo}`);
const modeloVersaoId = uuidv5(`checklist_modelo_versao:${modeloCodigo}:1`);

const lines = [];
lines.push(
  "-- Fase 7.2/8.A — seed determinístico gerado por scripts/gerar-seed-checklist.mjs",
  "-- — não editar à mão; se o conteúdo mudar, rode o script de novo e crie uma",
  "-- NOVA migration (esta versão, uma vez publicada, é imutável por construção",
  "-- — ver trigger da Fase 7.1).",
  "-- UUIDs são determinísticos (UUIDv5 sobre a chave natural de cada",
  "-- registro) — ON CONFLICT DO NOTHING torna esta migration idempotente.",
  "",
  `INSERT INTO public.legislacoes (id, codigo, nome, esfera, uf, ativo) VALUES`,
  `  (${sqlLiteral(legislacaoId)}, ${sqlLiteral(codigo)}, ${sqlLiteral(nome)}, ${sqlLiteral(esfera)}, ${sqlLiteral(uf)}, true)`,
  `ON CONFLICT (codigo) DO NOTHING;`,
  "",
  `INSERT INTO public.legislacao_versoes (id, legislacao_id, numero_versao, descricao, vigente_desde, ativo) VALUES`,
  `  (${sqlLiteral(legislacaoVersaoId)}, ${sqlLiteral(legislacaoId)}, 1, ${sqlLiteral(versaoDescricao)}, ${sqlLiteral(vigenteDesde)}, true)`,
  `ON CONFLICT (legislacao_id, numero_versao) DO NOTHING;`,
  "",
);

const modeloColumns = modeloDescricao !== null
  ? "id, legislacao_versao_id, codigo, nome, descricao, ativo"
  : "id, legislacao_versao_id, codigo, nome, ativo";
const modeloValues = modeloDescricao !== null
  ? `${sqlLiteral(modeloId)}, ${sqlLiteral(legislacaoVersaoId)}, ${sqlLiteral(modeloCodigo)}, ${sqlLiteral(modeloNome)}, ${sqlLiteral(modeloDescricao)}, true`
  : `${sqlLiteral(modeloId)}, ${sqlLiteral(legislacaoVersaoId)}, ${sqlLiteral(modeloCodigo)}, ${sqlLiteral(modeloNome)}, true`;
lines.push(
  `INSERT INTO public.checklist_modelos (${modeloColumns}) VALUES`,
  `  (${modeloValues})`,
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

if (!semResolver) {
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
} else {
  lines.push(
    `-- Fase 8.B — --sem-resolver: NÃO altera resolver_checklist_modelo_padrao().`,
    `-- Cadastrar esta legislação não muda o modelo padrão global (continua a`,
    `-- RDC 275 até uma ação explícita e separada trocar isso).`,
    `-- id do modelo-versão desta legislação, para referência: ${modeloVersaoId}`,
  );
}

process.stdout.write(lines.join("\n") + "\n");
