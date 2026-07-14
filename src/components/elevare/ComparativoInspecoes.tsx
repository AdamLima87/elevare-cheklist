import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checklistSections } from "@/lib/checklist-data";
import type { Resposta } from "@/lib/storage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumero } from "@/lib/storage";

interface InspecaoOption {
  id: string;
  numero_sequencial: number;
  data_conclusao: string | null;
  conformidade: number | null;
}

function useRespostas(inspecaoId: string | undefined) {
  return useQuery({
    queryKey: ["inspecao-respostas", inspecaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecoes")
        .select("respostas")
        .eq("id", inspecaoId as string)
        .single();
      if (error) throw error;
      return (data.respostas ?? {}) as Record<string, Resposta>;
    },
    enabled: !!inspecaoId,
  });
}

export function ComparativoInspecoes({ inspecoes }: { inspecoes: InspecaoOption[] }) {
  const ordenadas = useMemo(
    () =>
      [...inspecoes].sort(
        (a, b) => new Date(b.data_conclusao ?? 0).getTime() - new Date(a.data_conclusao ?? 0).getTime(),
      ),
    [inspecoes],
  );

  const [anteriorId, setAnteriorId] = useState<string | undefined>(ordenadas[1]?.id);
  const [atualId, setAtualId] = useState<string | undefined>(ordenadas[0]?.id);

  const { data: respostasAnterior, isLoading: loadingAnterior } = useRespostas(anteriorId);
  const { data: respostasAtual, isLoading: loadingAtual } = useRespostas(atualId);

  const anterior = ordenadas.find((i) => i.id === anteriorId);
  const atual = ordenadas.find((i) => i.id === atualId);

  const diffs = useMemo(() => {
    if (!respostasAnterior || !respostasAtual) return [];
    const result: {
      id: string;
      text: string;
      secao: string;
      antes: Resposta;
      depois: Resposta;
      mudanca: "melhorou" | "piorou" | "igual";
    }[] = [];

    checklistSections.forEach((secao) => {
      secao.items.forEach((item) => {
        const antes = respostasAnterior[item.id] ?? null;
        const depois = respostasAtual[item.id] ?? null;
        if (antes === depois) return;

        let mudanca: "melhorou" | "piorou" | "igual" = "igual";
        if (antes === "N" && depois === "S") mudanca = "melhorou";
        else if (antes === "S" && depois === "N") mudanca = "piorou";

        result.push({ id: item.id, text: item.text, secao: secao.title, antes, depois, mudanca });
      });
    });
    return result;
  }, [respostasAnterior, respostasAtual]);

  if (ordenadas.length < 2) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        É preciso pelo menos duas inspeções concluídas para comparar a evolução.
      </p>
    );
  }

  const deltaConformidade =
    atual?.conformidade != null && anterior?.conformidade != null
      ? Number(atual.conformidade) - Number(anterior.conformidade)
      : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Inspeção anterior</label>
          <Select value={anteriorId} onValueChange={setAnteriorId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {ordenadas.map((insp) => (
                <SelectItem key={insp.id} value={insp.id}>
                  {formatNumero(insp.numero_sequencial)} —{" "}
                  {insp.data_conclusao ? new Date(insp.data_conclusao).toLocaleDateString("pt-BR") : "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Inspeção atual</label>
          <Select value={atualId} onValueChange={setAtualId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {ordenadas.map((insp) => (
                <SelectItem key={insp.id} value={insp.id}>
                  {formatNumero(insp.numero_sequencial)} —{" "}
                  {insp.data_conclusao ? new Date(insp.data_conclusao).toLocaleDateString("pt-BR") : "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadingAnterior || loadingAtual ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conformidade</CardTitle>
              <CardDescription>
                {anterior?.conformidade != null ? `${Number(anterior.conformidade).toFixed(1)}%` : "—"}
                {" → "}
                {atual?.conformidade != null ? `${Number(atual.conformidade).toFixed(1)}%` : "—"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deltaConformidade != null && (
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold",
                    deltaConformidade > 0 && "bg-green-100 text-green-700",
                    deltaConformidade < 0 && "bg-red-100 text-red-700",
                    deltaConformidade === 0 && "bg-muted text-muted-foreground",
                  )}
                >
                  {deltaConformidade > 0 && <ArrowUp className="h-4 w-4" />}
                  {deltaConformidade < 0 && <ArrowDown className="h-4 w-4" />}
                  {deltaConformidade === 0 && <Minus className="h-4 w-4" />}
                  {deltaConformidade > 0 ? "+" : ""}
                  {deltaConformidade.toFixed(1)} pontos
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Itens que mudaram ({diffs.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {diffs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item mudou de resposta entre as duas inspeções.</p>
              ) : (
                diffs.map((d) => (
                  <div
                    key={d.id}
                    className={cn(
                      "rounded-md border p-3 text-sm",
                      d.mudanca === "melhorou" && "border-green-200 bg-green-50",
                      d.mudanca === "piorou" && "border-red-200 bg-red-50",
                      d.mudanca === "igual" && "border-border bg-muted/30",
                    )}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {d.secao}
                    </div>
                    <div className="mt-1">
                      <span className="font-mono text-xs">{d.id}.</span> {d.text}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium">
                      <span>{d.antes ?? "—"}</span>
                      <ArrowUp className="h-3 w-3 rotate-90" />
                      <span>{d.depois ?? "—"}</span>
                      {d.mudanca === "melhorou" && <span className="text-green-700">(melhorou)</span>}
                      {d.mudanca === "piorou" && <span className="text-red-700">(piorou)</span>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
