import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { buildCorsHeaders } from "../_shared/cors.ts";

// Backup lógico diário, 100% dentro do Supabase (sem servico externo):
// pg_cron (ver migration 20260812130000_db_backup_infra.sql) chama esta
// function 1x/dia com o service role key guardado em Vault. A function lista
// as tabelas de `public` via RPC SECURITY DEFINER, exporta cada uma via
// PostgREST (bypassa RLS por usar o service role), comprime em gzip e sobe
// pro bucket privado `db-backups`. Ao final, apaga backups com mais de
// RETENTION_DAYS. NÃO é um dump binário compatível com pg_restore — é um
// snapshot lógico de dados (JSON), pensado pra restauração manual em caso de
// perda de dado; o schema em si já vive versionado em supabase/migrations/.
const RETENTION_DAYS = 7;
const BUCKET = "db-backups";
const PAGE_SIZE = 1000;


function jsonError(corsHeaders: Record<string, string>, message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

async function exportarTabela(admin: ReturnType<typeof createClient>, tabela: string): Promise<unknown[]> {
  const linhas: unknown[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin
      .from(tabela)
      .select("*")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Falha ao exportar "${tabela}": ${error.message}`);
    if (!data || data.length === 0) break;
    linhas.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return linhas;
}

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

async function limparBackupsAntigos(admin: ReturnType<typeof createClient>) {
  const { data: arquivos, error } = await admin.storage.from(BUCKET).list("", { limit: 1000 });
  if (error || !arquivos) return { removidos: 0, erro: error?.message ?? null };

  const limite = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const antigos = arquivos
    .filter((f) => {
      const m = f.name.match(/^backup-(\d{4}-\d{2}-\d{2})\.json\.gz$/);
      if (!m) return false;
      const data = new Date(`${m[1]}T00:00:00Z`).getTime();
      return data < limite;
    })
    .map((f) => f.name);

  if (antigos.length === 0) return { removidos: 0, erro: null };
  const { error: delError } = await admin.storage.from(BUCKET).remove(antigos);
  return { removidos: delError ? 0 : antigos.length, erro: delError?.message ?? null };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Achado de auditoria: o verificador de JWT da plataforma só garante um
  // JWT válido (qualquer usuário autenticado passa), não que o chamador é
  // especificamente o cron. Checagem explícita: só aceita se o Authorization
  // bater exatamente com a service_role key — qualquer usuário comum,
  // mesmo autenticado, é rejeitado antes de disparar um backup completo.
  const authHeader = req.headers.get("Authorization") ?? "";
  const expectedServiceRoleAuth = `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`;
  if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || authHeader !== expectedServiceRoleAuth) {
    return jsonError(corsHeaders, "Acesso restrito ao processo de backup interno.", 403);
  }
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: tabelasRows, error: tabelasError } = await admin.rpc("listar_tabelas_backup");
    if (tabelasError || !tabelasRows) {
      return jsonError(corsHeaders, `Falha ao listar tabelas: ${tabelasError?.message ?? "sem dados"}`, 500);
    }
    // O RPC retorna TABLE(tabela text) — via PostgREST isso chega como
    // array de objetos ({ tabela: "..." }), não array de strings.
    const tabelas = (tabelasRows as { tabela: string }[]).map((r) => r.tabela);

    const dump: Record<string, unknown[]> = {};
    for (const nome of tabelas) {
      dump[nome] = await exportarTabela(admin, nome);
    }

    const payload = {
      geradoEm: new Date().toISOString(),
      projeto: Deno.env.get("SUPABASE_URL"),
      tabelas: dump,
    };

    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const comprimido = await gzip(bytes);

    const dataHoje = new Date().toISOString().slice(0, 10);
    const caminho = `backup-${dataHoje}.json.gz`;

    const { error: uploadError } = await admin.storage.from(BUCKET).upload(caminho, comprimido, {
      contentType: "application/gzip",
      upsert: true,
    });
    if (uploadError) return jsonError(corsHeaders, `Falha ao subir backup: ${uploadError.message}`, 500);

    const limpeza = await limparBackupsAntigos(admin);

    return new Response(
      JSON.stringify({
        ok: true,
        arquivo: caminho,
        tabelas: Object.keys(dump).length,
        linhasTotal: Object.values(dump).reduce((n, rows) => n + rows.length, 0),
        tamanhoBytes: comprimido.length,
        backupsRemovidos: limpeza.removidos,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("Erro inesperado em db-backup", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(corsHeaders, `Não foi possível concluir o backup: ${message}`, 500);
  }
});
