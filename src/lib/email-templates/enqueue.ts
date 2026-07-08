import { render } from "@react-email/components";
import * as React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TEMPLATES } from "./registry";

// Configuration baked in at scaffold time
const SITE_NAME = "Elevare Consultoria";
const SENDER_DOMAIN = "notify.elevareconsultoria.com";
const FROM_DOMAIN = "elevareconsultoria.com";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface EnqueueTransactionalEmailParams {
  supabase: SupabaseClient<any, any>;
  templateName: string;
  recipientEmail: string;
  templateData?: Record<string, any>;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface EnqueueTransactionalEmailResult {
  success: boolean;
  reason?: string;
}

/**
 * Looks up a registered template, checks suppression, ensures an unsubscribe
 * token, renders the email, logs it, and enqueues it for sending via pgmq.
 * Extracted from the /lovable/email/transactional/send route so the same
 * logic can be called from a user-authenticated HTTP request (send.ts) or a
 * service-role-authenticated scheduled job (e.g. reinspection reminders)
 * without duplicating the send pipeline.
 */
export async function enqueueTransactionalEmail({
  supabase,
  templateName,
  recipientEmail,
  templateData = {},
  metadata,
  idempotencyKey,
}: EnqueueTransactionalEmailParams): Promise<EnqueueTransactionalEmailResult> {
  const template = TEMPLATES[templateName];

  if (!template) {
    console.error("Template not found in registry", { templateName });
    return {
      success: false,
      reason: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    };
  }

  const effectiveRecipient = template.to || recipientEmail;
  if (!effectiveRecipient) {
    return { success: false, reason: "recipientEmail is required" };
  }

  // 1. Check suppression list
  const { data: suppressed, error: suppressionError } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", effectiveRecipient.toLowerCase())
    .maybeSingle();

  if (suppressionError) {
    console.error("Suppression check failed", { error: suppressionError });
    return { success: false, reason: "Failed to verify suppression status" };
  }

  const messageId = crypto.randomUUID();

  if (suppressed) {
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "suppressed",
      metadata,
    });
    return { success: false, reason: "email_suppressed" };
  }

  // 2. Get or create unsubscribe token
  const normalizedEmail = effectiveRecipient.toLowerCase();
  let unsubscribeToken: string;

  const { data: existingToken, error: tokenLookupError } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (tokenLookupError) {
    console.error("Token lookup failed", { error: tokenLookupError });
    return { success: false, reason: "Failed to prepare email" };
  }

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token;
  } else {
    unsubscribeToken = generateToken();
    await supabase
      .from("email_unsubscribe_tokens")
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: "email", ignoreDuplicates: true },
      );

    const { data: storedToken } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalizedEmail)
      .maybeSingle();

    unsubscribeToken = storedToken?.token || unsubscribeToken;
  }

  // 3. Render React Email template
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const plainText = await render(element, { plainText: true });

  const resolvedSubject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  // 4. Log + enqueue
  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: "pending",
    metadata,
  });

  const { error: enqueueError } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject || "Notificação",
      html,
      text: plainText,
      purpose: "transactional",
      label: templateName,
      idempotency_key: idempotencyKey || messageId,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqueueError) {
    console.error("Failed to enqueue email", { error: enqueueError });
    await supabase
      .from("email_send_log")
      .update({ status: "failed", error_message: "Failed to enqueue email" })
      .eq("message_id", messageId);
    return { success: false, reason: "Failed to enqueue email" };
  }

  console.log("Transactional email enqueued successfully", { messageId });
  return { success: true };
}
