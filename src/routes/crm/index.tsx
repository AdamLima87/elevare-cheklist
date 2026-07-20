import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

// Placeholder: a Mesa de Trabalho de verdade entra na Etapa 6 do CRM
// Comercial. Por enquanto, /crm redireciona pra lista de Contas — existe
// só pra o item do menu (Sidebar) não apontar pra uma rota inexistente.
export const Route = createFileRoute("/crm/")({
  component: CrmIndexRedirect,
});

function CrmIndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/crm/empresas", replace: true });
  }, [navigate]);
  return null;
}
