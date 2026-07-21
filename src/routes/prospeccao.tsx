import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

// Prospecção aposentada (Etapa 8 do CRM Comercial) — os dados já foram
// migrados pra crm_empresas/crm_oportunidades. Rota mantida só como
// redirect stub pra não quebrar links/favoritos antigos; o código de
// verdade (e o item de menu) já foi removido. Numa release futura, depois
// de um ciclo inteiro sem regressão, este arquivo e o código morto de
// useClientes.ts (ETAPAS_FUNIL, useUpdateClienteFunil,
// useConverterProspectEmCliente) são removidos de vez.
export const Route = createFileRoute("/prospeccao")({
  component: ProspeccaoRedirect,
});

function ProspeccaoRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/crm/pipeline", replace: true });
  }, [navigate]);
  return null;
}
