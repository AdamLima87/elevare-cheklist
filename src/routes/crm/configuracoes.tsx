import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

// Configurações do CRM foram unificadas na tela geral de Configurações
// (src/routes/configuracoes.tsx, aba "crm"). Rota mantida só como redirect
// stub pra não quebrar links/favoritos antigos; o código de verdade já
// não mora mais aqui.
export const Route = createFileRoute("/crm/configuracoes")({
  component: CrmConfiguracoesRedirect,
});

function CrmConfiguracoesRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/configuracoes", search: { tab: "crm" }, replace: true });
  }, [navigate]);
  return null;
}
