import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

// Gestão de usuários foi unificada na tela geral de Configurações
// (src/routes/configuracoes.tsx, aba "usuarios"). Rota mantida só como
// redirect stub pra não quebrar links/favoritos antigos.
export const Route = createFileRoute("/admin")({
  component: AdminRedirect,
});

function AdminRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/configuracoes", search: { tab: "usuarios" }, replace: true });
  }, [navigate]);
  return null;
}
