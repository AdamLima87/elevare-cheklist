import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { enqueueTransactionalEmail } from "@/lib/email-templates/enqueue";
import { dedupeLatestPerCnpj, dueDate, isWithinReminderWindow } from "@/lib/reinspection";

const SITE_ORIGIN = "https://elevareconsultoria.com";

interface DueInspecao {
  id: string;
  cnpj: string | null;
  data_conclusao: string | null;
  consultor_id: string | null;
  estabelecimento_nome: string | null;
  dados: any;
}

export const Route = createFileRoute("/lovable/email/reminders/check-reinspection")({
  server: {
    handlers: {
      // Triggered daily by a pg_cron job (see supabase/migrations) with the
      // service-role key as a Bearer token — same auth idiom as
      // /lovable/email/queue/process, since this is a scheduled job, not a
      // user-initiated request.
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error("Missing required environment variables");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.slice("Bearer ".length).trim();
        if (token !== supabaseServiceKey) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        const supabase: SupabaseClient<any, any> = createClient(supabaseUrl, supabaseServiceKey);

        const { data: inspecoes, error } = await supabase
          .from("inspecoes")
          .select("id, cnpj, data_conclusao, consultor_id, estabelecimento_nome, dados")
          .eq("status", "concluida")
          .not("cnpj", "is", null)
          .not("data_conclusao", "is", null)
          .order("data_conclusao", { ascending: false });

        if (error) {
          console.error("Failed to fetch inspecoes for reinspection check", { error });
          return Response.json({ error: "Failed to fetch inspections" }, { status: 500 });
        }

        const latest = dedupeLatestPerCnpj((inspecoes ?? []) as DueInspecao[]);
        const now = new Date();
        const due = latest.filter((insp) =>
          isWithinReminderWindow(dueDate(insp.data_conclusao as string), now),
        );

        let remindersSent = 0;

        if (due.length > 0) {
          const consultorIds = Array.from(
            new Set(due.map((i) => i.consultor_id).filter((id): id is string => Boolean(id))),
          );
          const { data: consultores } = consultorIds.length
            ? await supabase.from("profiles").select("id, email").in("id", consultorIds)
            : { data: [] as { id: string; email: string | null }[] };
          const consultorEmailMap = new Map<string, string | null>(
            ((consultores ?? []) as { id: string; email: string | null }[]).map((c) => [
              c.id,
              c.email,
            ]),
          );

          for (const insp of due) {
            const prazo = dueDate(insp.data_conclusao as string).toISOString();
            const clienteEmail =
              insp.dados?.estabelecimento?.respLegalEmail ||
              insp.dados?.estabelecimento?.email ||
              null;

            const recipients: {
              papel: "consultor" | "cliente";
              email: string | null | undefined;
              linkResultado: string;
            }[] = [
              {
                papel: "consultor",
                email: insp.consultor_id ? consultorEmailMap.get(insp.consultor_id) : null,
                linkResultado: `${SITE_ORIGIN}/estabelecimento?cnpj=${insp.cnpj}`,
              },
              {
                papel: "cliente",
                email: clienteEmail,
                linkResultado: `${SITE_ORIGIN}/meu-resultado`,
              },
            ];

            for (const { papel, email, linkResultado } of recipients) {
              if (!email) {
                console.warn("Skipping reinspection reminder: no email for recipient", {
                  inspecao_id: insp.id,
                  papel,
                });
                continue;
              }

              // Per-recipient dedupe: a prior run may have sent to one recipient but
              // failed for the other, so check each one independently rather than a
              // single shared flag.
              const { data: alreadySent } = await supabase
                .from("email_send_log")
                .select("id")
                .eq("template_name", "reinspection-reminder")
                .eq("recipient_email", email)
                .contains("metadata", { inspecao_id: insp.id, papel })
                .maybeSingle();

              if (alreadySent) continue;

              const result = await enqueueTransactionalEmail({
                supabase,
                templateName: "reinspection-reminder",
                recipientEmail: email,
                templateData: {
                  papel,
                  nome_estabelecimento: insp.estabelecimento_nome,
                  cnpj: insp.cnpj,
                  data_conclusao_anterior: insp.data_conclusao,
                  data_prevista_reinspecao: prazo,
                  link_resultado: linkResultado,
                },
                metadata: { inspecao_id: insp.id, tipo: "reinspection_reminder", papel },
              });

              if (result.success) remindersSent++;
              else
                console.error("Failed to enqueue reinspection reminder", {
                  inspecao_id: insp.id,
                  papel,
                  reason: result.reason,
                });
            }
          }
        }

        return Response.json({ checked: latest.length, dueCount: due.length, remindersSent });
      },
    },
  },
});
