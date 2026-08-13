import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/elevare/Logo";
import { Loader2, Download } from "lucide-react";
import { gerarPdfProposta } from "@/lib/pdf-proposta";
import { gerarPdfContrato } from "@/lib/pdf-contrato";

export const Route = createFileRoute("/documento/$token")({
  head: () => ({ meta: [{ title: "Documento · RDCheck" }] }),
  component: DocumentoPublicoPage,
});

function formatMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface DocumentoPayload {
  tipo: "proposta" | "contrato";
  status: string;
  clienteNome: string;
  marca?: { nome?: string; contato?: string };
  numeroRevisao?: number;
  valorTotal?: number;
  itens?: { nome: string; descricao: string | null; valor: number }[];
  secoes?: { titulo: string; corpo: string }[];
}

// Página pública (sem login) que resolve um link de proposta/contrato via
// crm-documento-publico. Acessar esta página NUNCA equivale a aceite/leitura
// confirmada — só o consultor registra isso manualmente, de dentro do
// sistema. O PDF é gerado no navegador do próprio visitante.
function DocumentoPublicoPage() {
  const { token } = useParams({ from: "/documento/$token" });
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [dados, setDados] = useState<DocumentoPayload | null>(null);
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("crm-documento-publico", { body: { token } });
      if (cancelado) return;
      if (error || !data?.success) {
        setEstado("erro");
        return;
      }
      setDados(data as DocumentoPayload);
      setEstado("ok");
    })();
    return () => {
      cancelado = true;
    };
  }, [token]);

  const handleBaixar = async () => {
    if (!dados) return;
    setBaixando(true);
    try {
      await supabase.functions.invoke("crm-documento-publico", { body: { token, action: "baixar" } });
      const blob =
        dados.tipo === "proposta"
          ? await gerarPdfProposta({
              numeroRevisao: dados.numeroRevisao ?? 1,
              clienteNome: dados.clienteNome,
              itens: dados.itens ?? [],
              valorTotal: dados.valorTotal ?? 0,
              marca: dados.marca,
            })
          : await gerarPdfContrato({
              clienteNome: dados.clienteNome,
              secoes: dados.secoes ?? [],
              status: dados.status,
              marca: dados.marca,
            });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${dados.tipo === "proposta" ? "Proposta" : "Contrato"}_${dados.clienteNome || "documento"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="items-center text-center">
          <Logo />
          <CardTitle className="mt-4">
            {dados?.tipo === "contrato" ? "Contrato" : "Proposta Comercial"}
          </CardTitle>
          {dados && <CardDescription>{dados.clienteNome}</CardDescription>}
        </CardHeader>
        <CardContent>
          {estado === "carregando" && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {estado === "erro" && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Este link é inválido, expirou ou foi revogado. Entre em contato com quem enviou para solicitar um novo.
            </p>
          )}
          {estado === "ok" && dados && (
            <div className="space-y-4">
              {dados.tipo === "proposta" && (
                <>
                  <p className="text-xs text-muted-foreground">Revisão {dados.numeroRevisao}</p>
                  <div className="space-y-2 text-sm">
                    {dados.itens?.map((item, i) => (
                      <div key={i} className="flex justify-between border-b pb-2 last:border-0">
                        <span>{item.nome}</span>
                        <span>{formatMoeda(item.valor)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-right text-lg font-semibold">Total: {formatMoeda(dados.valorTotal ?? 0)}</p>
                </>
              )}
              {dados.tipo === "contrato" && (
                <div className="max-h-96 space-y-4 overflow-y-auto text-sm">
                  {dados.secoes?.map((secao, i) => (
                    <div key={i}>
                      <p className="font-semibold">{secao.titulo}</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{secao.corpo}</p>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={handleBaixar} disabled={baixando} className="w-full gap-1.5">
                {baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar PDF
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                O aceite/assinatura deste documento é feito diretamente com sua consultoria, fora desta página.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
