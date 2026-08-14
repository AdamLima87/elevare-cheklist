import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Logo } from "@/components/elevare/Logo";
import { Loader2, Download, ShieldCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
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
  podeAssinarEletronicamente?: boolean;
  emailMascarado?: string | null;
  assinaturaEletronica?: { nome: string; emailMascarado: string; assinadoEm: string; hash: string } | null;
}

type EtapaAssinatura = "inicial" | "codigo_enviado" | "assinado";

// Página pública (sem login) que resolve um link de proposta/contrato via
// crm-documento-publico. Acessar esta página NUNCA equivale a aceite/leitura
// confirmada — só o consultor registra isso manualmente, de dentro do
// sistema. O PDF é gerado no navegador do próprio visitante.
function DocumentoPublicoPage() {
  const { token } = useParams({ from: "/documento/$token" });
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [dados, setDados] = useState<DocumentoPayload | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [etapaAssinatura, setEtapaAssinatura] = useState<EtapaAssinatura>("inicial");
  const [solicitandoCodigo, setSolicitandoCodigo] = useState(false);
  const [verificandoCodigo, setVerificandoCodigo] = useState(false);
  const [nomeSignatario, setNomeSignatario] = useState("");
  const [codigo, setCodigo] = useState("");

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
              assinaturaEletronica: dados.assinaturaEletronica,
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

  const handleSolicitarCodigo = async () => {
    if (!nomeSignatario.trim()) {
      toast.error("Informe seu nome completo antes de solicitar o código.");
      return;
    }
    setSolicitandoCodigo(true);
    try {
      const res = await fetch("/documento/otp/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Não foi possível gerar o código.");
        return;
      }
      setEtapaAssinatura("codigo_enviado");
      toast.success(`Código enviado para ${body.emailMascarado || "seu e-mail"}.`);
    } finally {
      setSolicitandoCodigo(false);
    }
  };

  const handleVerificarCodigo = async () => {
    if (codigo.length !== 6) {
      toast.error("Informe o código de 6 dígitos.");
      return;
    }
    setVerificandoCodigo(true);
    try {
      const res = await fetch("/documento/otp/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, codigo, nomeSignatario: nomeSignatario.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Código inválido ou expirado.");
        return;
      }
      setEtapaAssinatura("assinado");
      setDados((prev) => (prev ? { ...prev, status: "assinado" } : prev));
      toast.success("Contrato assinado com sucesso!");
    } finally {
      setVerificandoCodigo(false);
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

              {dados.tipo === "contrato" && dados.status === "assinado" && (
                <p className="flex items-center justify-center gap-2 text-center text-sm text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Este contrato já foi assinado.
                </p>
              )}

              {dados.tipo === "contrato" && dados.status === "enviado" && dados.podeAssinarEletronicamente && etapaAssinatura !== "assinado" && (
                <div className="space-y-3 rounded-md border p-4">
                  {etapaAssinatura === "inicial" && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Confirme seu nome e solicite um código de verificação para assinar eletronicamente este
                        contrato.
                      </p>
                      <div>
                        <Label>Seu nome completo</Label>
                        <Input value={nomeSignatario} onChange={(e) => setNomeSignatario(e.target.value)} placeholder="Nome completo" />
                      </div>
                      <Button onClick={handleSolicitarCodigo} disabled={solicitandoCodigo} className="w-full gap-1.5">
                        {solicitandoCodigo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Assinar eletronicamente
                      </Button>
                    </>
                  )}
                  {etapaAssinatura === "codigo_enviado" && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Enviamos um código de verificação para {dados.emailMascarado || "seu e-mail"}. Ele vale por 10
                        minutos.
                      </p>
                      <div className="flex justify-center">
                        <InputOTP maxLength={6} value={codigo} onChange={setCodigo}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <Button onClick={handleVerificarCodigo} disabled={verificandoCodigo} className="w-full gap-1.5">
                        {verificandoCodigo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar assinatura"}
                      </Button>
                      <button
                        type="button"
                        className="w-full text-center text-xs text-muted-foreground underline"
                        onClick={handleSolicitarCodigo}
                        disabled={solicitandoCodigo}
                      >
                        Reenviar código
                      </button>
                    </>
                  )}
                </div>
              )}

              {etapaAssinatura === "assinado" && (
                <p className="flex items-center justify-center gap-2 text-center text-sm text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Assinatura confirmada com sucesso.
                </p>
              )}

              {(dados.tipo === "proposta" || (dados.tipo === "contrato" && !dados.podeAssinarEletronicamente && dados.status !== "assinado")) && (
                <p className="text-center text-xs text-muted-foreground">
                  O aceite/assinatura deste documento é feito diretamente com sua consultoria, fora desta página.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
