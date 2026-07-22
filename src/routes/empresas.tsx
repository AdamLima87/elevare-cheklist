import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

// Gestão de empresas (tenants) foi unificada na tela geral de
// Configurações (src/routes/configuracoes.tsx, aba "empresas", só
// super_admin). Rota mantida só como redirect stub pra não quebrar
// links/favoritos antigos.
export const Route = createFileRoute("/empresas")({
  component: EmpresasRedirect,
});

function EmpresasRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/configuracoes", search: { tab: "empresas" }, replace: true });
  }, [navigate]);
  return null;
}
