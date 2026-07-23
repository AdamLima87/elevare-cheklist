import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PlatformLayout } from "@/components/platform/PlatformLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { usePlatformCupons, useCriarCupom, useAtualizarCupomAtivo } from "@/hooks/usePlatform";
import type { PlatformCupom } from "@/lib/platform/platformService";

export const Route = createFileRoute("/plataforma/cupons")({
  head: () => ({ meta: [{ title: "Cupons · Administração da Plataforma · RDCheck" }] }),
  component: () => (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <PlatformLayout>
        <CuponsPage />
      </PlatformLayout>
    </ProtectedRoute>
  ),
});

const TIPO_LABEL: Record<string, string> = {
  percentual: "%",
  valor_fixo: "R$ fixo",
  primeiro_periodo_gratis: "1º período grátis",
};

function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function CuponsPage() {
  const { data: cupons = [], isLoading } = usePlatformCupons();
  const atualizarAtivo = useAtualizarCupomAtivo();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cupons</h1>
          <p className="text-sm text-muted-foreground">
            Desconto percentual, valor fixo ou primeiro período grátis. Não cumulativos nesta versão.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo Cupom
            </Button>
          </DialogTrigger>
          <NovoCupomDialog onCreated={() => setOpen(false)} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">Código</TableHead>
                    <TableHead className="font-bold">Tipo</TableHead>
                    <TableHead className="font-bold">Plano</TableHead>
                    <TableHead className="font-bold text-center">Usos</TableHead>
                    <TableHead className="font-bold">Válido até</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="font-bold text-right">Ativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cupons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Nenhum cupom cadastrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cupons.map((c: PlatformCupom) => (
                      <TableRow key={c.id}>
                        <TableCell className="py-3 font-mono font-medium">{c.codigo}</TableCell>
                        <TableCell className="text-sm">
                          {TIPO_LABEL[c.tipo_desconto]}
                          {c.tipo_desconto !== "primeiro_periodo_gratis" ? ` — ${c.valor}${c.tipo_desconto === "percentual" ? "%" : ""}` : ""}
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.plano_codigo ?? "qualquer"}
                          {c.periodicidade ? ` · ${c.periodicidade}` : ""}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {c.utilizacoes_atual}
                          {c.max_utilizacoes ? ` / ${c.max_utilizacoes}` : ""}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtData(c.data_fim)}</TableCell>
                        <TableCell>
                          <Badge variant={c.ativo ? "outline" : "destructive"}>{c.ativo ? "Ativo" : "Inativo"}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={c.ativo}
                            onCheckedChange={async (v) => {
                              try {
                                await atualizarAtivo.mutateAsync({ cupomId: c.id, ativo: v });
                              } catch (err: any) {
                                toast.error(err.message || "Erro ao alterar o cupom.");
                              }
                            }}
                            disabled={atualizarAtivo.isPending}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NovoCupomDialog({ onCreated }: { onCreated: () => void }) {
  const criar = useCriarCupom();
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoDesconto, setTipoDesconto] = useState("percentual");
  const [valor, setValor] = useState("");
  const [planoCodigo, setPlanoCodigo] = useState("qualquer");
  const [periodicidade, setPeriodicidade] = useState("qualquer");
  const [dataFim, setDataFim] = useState("");
  const [maxUtilizacoes, setMaxUtilizacoes] = useState("");
  const [maxPorEmpresa, setMaxPorEmpresa] = useState("1");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    try {
      await criar.mutateAsync({
        codigo: codigo.trim(),
        descricao,
        tipoDesconto,
        valor: tipoDesconto === "primeiro_periodo_gratis" ? 0 : Number(valor),
        planoCodigo: planoCodigo === "qualquer" ? null : planoCodigo,
        periodicidade: periodicidade === "qualquer" ? null : periodicidade,
        dataFim: dataFim || null,
        maxUtilizacoes: maxUtilizacoes ? Number(maxUtilizacoes) : null,
        maxUtilizacoesPorEmpresa: Number(maxPorEmpresa) || 1,
      });
      toast.success(`Cupom "${codigo.toUpperCase()}" criado.`);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar cupom.");
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Novo Cupom</DialogTitle>
          <DialogDescription>Válido a partir de agora. Preço final é sempre calculado no backend no momento do checkout.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="codigo">Código</Label>
            <Input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} required placeholder="EX: BEMVINDO10" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="descricao">Descrição (interna)</Label>
            <Input id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Tipo de desconto</Label>
              <Select value={tipoDesconto} onValueChange={setTipoDesconto}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual</SelectItem>
                  <SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem>
                  <SelectItem value="primeiro_periodo_gratis">1º período grátis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipoDesconto !== "primeiro_periodo_gratis" && (
              <div className="grid gap-2">
                <Label htmlFor="valor">{tipoDesconto === "percentual" ? "Percentual (%)" : "Valor (R$)"}</Label>
                <Input id="valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Plano</Label>
              <Select value={planoCodigo} onValueChange={setPlanoCodigo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualquer">Qualquer plano</SelectItem>
                  <SelectItem value="pro">Pago (pro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Periodicidade</Label>
              <Select value={periodicidade} onValueChange={setPeriodicidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qualquer">Qualquer</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="dataFim">Válido até</Label>
              <Input id="dataFim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxUtilizacoes">Limite total</Label>
              <Input id="maxUtilizacoes" type="number" placeholder="Sem limite" value={maxUtilizacoes} onChange={(e) => setMaxUtilizacoes(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxPorEmpresa">Limite por usuário</Label>
              <Input id="maxPorEmpresa" type="number" value={maxPorEmpresa} onChange={(e) => setMaxPorEmpresa(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={criar.isPending || !codigo.trim()} className="w-full">
            {criar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Criar Cupom"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
