import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { classificacao } from "@/lib/storage";

export function useResendInspectionEmail() {
  return useMutation({
    mutationFn: async (insp: any) => {
      const email =
        insp.dados?.estabelecimento?.respLegalEmail || insp.dados?.estabelecimento?.email;
      const cnpj = insp.cnpj || insp.dados?.estabelecimento?.cnpj || "";
      if (!email) throw new Error("E-mail do cliente não encontrado.");

      const cls = classificacao(Number(insp.conformidade));
      const response = await fetch("/lovable/email/transactional/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          templateName: "inspection",
          recipientEmail: email,
          templateData: {
            email_cliente: email,
            nome_estabelecimento: insp.estabelecimento_nome,
            cnpj,
            data_inspecao: insp.data_inicio,
            conformidade: insp.conformidade,
            classificacaoLabel: cls.label,
            classificacaoTone: cls.tone,
            link_resultado: `${window.location.origin}/meu-resultado`,
          },
        }),
      });

      if (!response.ok) throw new Error("Falha ao reenviar e-mail");
      return email as string;
    },
    onSuccess: (email) => toast.success(`Relatório reenviado para ${email}`),
    onError: (error: Error) => {
      console.error("Error resending email:", error);
      toast.error(
        error.message === "E-mail do cliente não encontrado."
          ? error.message
          : "Erro ao reenviar e-mail.",
      );
    },
  });
}
