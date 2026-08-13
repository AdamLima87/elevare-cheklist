import { supabase } from "@/integrations/supabase/client";

// Fase B — dispara os e-mails "proposta-disponivel"/"contrato-disponivel"
// reaproveitando o endpoint transacional já existente
// (/lovable/email/transactional/send), que roda com service role no
// servidor e já cuida de suppression list/log/fila — sem duplicar esse
// pipeline aqui. Chamado a partir do client autenticado (mesmo padrão de
// outros disparos de e-mail do produto).
export async function enviarEmailComercial(input: {
  templateName: "proposta-disponivel" | "contrato-disponivel";
  recipientEmail: string;
  templateData: Record<string, unknown>;
}): Promise<{ success: boolean; reason?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { success: false, reason: "not_authenticated" };

  const res = await fetch("/lovable/email/transactional/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      templateName: input.templateName,
      recipientEmail: input.recipientEmail,
      templateData: input.templateData,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { success: false, reason: body.error || `status ${res.status}` };
  }
  return { success: true };
}
