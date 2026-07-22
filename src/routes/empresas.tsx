import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

// Gestão de empresas (tenants) é Administração da Plataforma, não
// configuração de tenant — mora em /plataforma/empresas (só super_admin).
// Rota mantida só como redirect stub pra não quebrar links/favoritos
// antigos (inclusive o antigo /configuracoes?tab=empresas).
export const Route = createFileRoute("/empresas")({
  component: EmpresasRedirect,
});

function EmpresasRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/plataforma/empresas", replace: true });
  }, [navigate]);
  return null;
}
