import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Logo } from "@/components/elevare/Logo";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/privacidade/contato")({
  head: () => ({ meta: [{ title: "Canal de Privacidade · RDCheck" }] }),
  component: PrivacidadeContatoPage,
});

function PrivacidadeContatoPage() {
  const [nome, setNome] = useState("");
  const [identificador, setIdentificador] = useState("");
  const [tipo, setTipo] = useState<"exportar" | "excluir" | "duvida">("exportar");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !identificador.trim()) {
      toast.error("Preencha nome e e-mail ou CPF.");
      return;
    }
    setEnviando(true);
    try {
      const { error } = await supabase.rpc("registrar_solicitacao_privacidade", {
        p_nome: nome.trim(),
        p_identificador: identificador.trim(),
        p_tipo: tipo,
        p_mensagem: mensagem.trim() || null,
      });
      if (error) throw error;
      setEnviado(true);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível registrar sua solicitação. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <Link to="/politica-privacidade" className="text-sm text-[#184878] hover:underline">
            Política de Privacidade
          </Link>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Canal de Privacidade</h1>
        <p className="text-sm text-slate-500 mb-8">
          Use este formulário para pedir uma cópia dos seus dados pessoais, pedir a exclusão/anonimização deles, ou
          esclarecer qualquer dúvida sobre como tratamos suas informações.
        </p>

        {enviado ? (
          <Card>
            <CardContent className="pt-6 flex flex-col items-center text-center gap-3 py-10">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="font-medium text-slate-800">Solicitação registrada.</p>
              <p className="text-sm text-slate-500">
                Vamos analisar seu pedido e retornar pelo e-mail ou CPF informado.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nova solicitação</CardTitle>
              <CardDescription>Respondemos em até 15 dias úteis, conforme a LGPD.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="nome">Seu nome completo</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="identificador">Seu e-mail ou CPF</Label>
                  <Input
                    id="identificador"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    placeholder="voce@exemplo.com ou 000.000.000-00"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Usamos isso só para localizar seus dados no sistema — o mesmo identificador que apareceu em algum
                    contrato, relatório de inspeção ou cadastro.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>O que você precisa?</Label>
                  <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="exportar" id="tipo-exportar" />
                      <Label htmlFor="tipo-exportar" className="font-normal">
                        Quero uma cópia dos meus dados
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="excluir" id="tipo-excluir" />
                      <Label htmlFor="tipo-excluir" className="font-normal">
                        Quero excluir/anonimizar meus dados
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="duvida" id="tipo-duvida" />
                      <Label htmlFor="tipo-duvida" className="font-normal">
                        Tenho uma dúvida
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mensagem">Mensagem (opcional)</Label>
                  <Textarea id="mensagem" value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={3} />
                </div>
                <Button type="submit" disabled={enviando} className="w-full gap-2">
                  {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar solicitação
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
