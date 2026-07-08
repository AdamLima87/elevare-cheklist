import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { enqueueTransactionalEmail } from "@/lib/email-templates/enqueue";

function statusForReason(reason: string | undefined): number {
  if (!reason) return 200;
  if (reason.startsWith("Template '")) return 404;
  if (reason === "recipientEmail is required") return 400;
  if (reason === "email_suppressed") return 200;
  return 500;
}

export const Route = createFileRoute("/lovable/email/transactional/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (!supabaseUrl || !supabaseServiceKey) {
            console.error("Missing required environment variables");
            return Response.json({ error: "Server configuration error" }, { status: 500 });
          }

          // Parse request body
          let body: any;
          try {
            body = await request.json();
          } catch {
            return Response.json({ error: "Invalid JSON in request body" }, { status: 400 });
          }

          // Verify the caller has a valid Supabase auth token.
          const authHeader = request.headers.get("Authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const token = authHeader.slice("Bearer ".length).trim();
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          const {
            data: { user },
            error: authError,
          } = await supabase.auth.getUser(token);

          if (authError || !user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          // Parse request body data
          const templateName: string = body.templateName || body.template_name;
          const recipientEmail: string = body.recipientEmail || body.recipient_email;
          const idempotencyKey: string | undefined = body.idempotencyKey || body.idempotency_key;
          const templateData: Record<string, any> =
            body.templateData && typeof body.templateData === "object" ? body.templateData : {};

          if (!templateName) {
            return Response.json({ error: "templateName is required" }, { status: 400 });
          }

          const result = await enqueueTransactionalEmail({
            supabase,
            templateName,
            recipientEmail,
            templateData,
            idempotencyKey,
          });

          if (!result.success && result.reason === "email_suppressed") {
            return Response.json({ success: false, reason: "email_suppressed" });
          }

          if (!result.success) {
            return Response.json(
              { error: result.reason },
              { status: statusForReason(result.reason) },
            );
          }

          return Response.json({ success: true, queued: true });
        } catch (error: any) {
          console.error("Unhandled server error in transactional/send:", error);
          return Response.json(
            { error: error.message || "Internal server error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
