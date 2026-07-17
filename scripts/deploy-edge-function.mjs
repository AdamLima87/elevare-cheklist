// Deploy de uma Edge Function via Supabase Management API, "achatando" os
// imports de ../_shared/X.ts para ./X.ts — a API de deploy multipart não
// preserva subpastas (confirmado empiricamente ao implementar public-signup:
// um import "../_shared/app-url.ts" falhava com "Module not found" porque
// os arquivos enviados ficam todos no mesmo nível do bundle).
//
// Ferramenta operacional — este projeto não tem Supabase CLI/Docker
// disponível no ambiente de desenvolvimento, então o deploy é feito direto
// via Management API. Se/quando o CLI estiver disponível, `supabase
// functions deploy <slug>` faz esse bundling automaticamente e este script
// deixa de ser necessário.
//
// uso: node scripts/deploy-edge-function.mjs <mgmt_token> <project_ref> <function_dir> <slug>
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const [, , TOKEN, REF, FN_DIR, SLUG] = process.argv;
if (!TOKEN || !REF || !FN_DIR || !SLUG) {
  console.error("uso: node scripts/deploy-edge-function.mjs <mgmt_token> <project_ref> <function_dir> <slug>");
  process.exit(1);
}

const SHARED_DIR = join(FN_DIR, "..", "_shared");
const indexSrc = readFileSync(join(FN_DIR, "index.ts"), "utf8");

const sharedImportRe = /from\s+["']\.\.\/_shared\/([\w-]+)\.ts["']/g;
const sharedFiles = new Set();
let m;
while ((m = sharedImportRe.exec(indexSrc))) sharedFiles.add(m[1]);

const flatIndex = indexSrc.replace(sharedImportRe, (_match, name) => `from "./${name}.ts"`);

const tmp = mkdtempSync(join(tmpdir(), "edge-deploy-"));
writeFileSync(join(tmp, "index.ts"), flatIndex);
for (const name of sharedFiles) {
  const content = readFileSync(join(SHARED_DIR, `${name}.ts`), "utf8");
  writeFileSync(join(tmp, `${name}.ts`), content);
}

const metaPath = join(tmp, "_meta.json");
writeFileSync(metaPath, JSON.stringify({ entrypoint_path: "index.ts", name: SLUG, verify_jwt: false }));

const fileNames = ["index.ts", ...[...sharedFiles].map((f) => `${f}.ts`)];
const fileArgs = fileNames.map((f) => `-F "file=@${join(tmp, f)};filename=${f}"`).join(" ");

const cmd = `curl -s -X POST "https://api.supabase.com/v1/projects/${REF}/functions/deploy?slug=${SLUG}" -H "Authorization: Bearer ${TOKEN}" ${fileArgs} -F "metadata=<${metaPath};type=application/json"`;

console.log(`Deployando ${SLUG} (${fileNames.length} arquivos: ${fileNames.join(", ")})`);
const result = execSync(cmd, { encoding: "utf8" });
console.log(result);

rmSync(tmp, { recursive: true, force: true });
