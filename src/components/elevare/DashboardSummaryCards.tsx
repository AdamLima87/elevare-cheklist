import { LineChart, Line, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { TrendPoint } from "@/lib/compliance-trend";

type Tone = "success" | "warning" | "destructive";

const TONE_CLASSES: Record<Tone, { border: string; text: string; bg: string; indicator: string }> = {
  success: { border: "border-success", text: "text-success", bg: "bg-success/10", indicator: "bg-success" },
  warning: { border: "border-warning", text: "text-warning", bg: "bg-warning/10", indicator: "bg-warning" },
  destructive: {
    border: "border-destructive",
    text: "text-destructive",
    bg: "bg-destructive/10",
    indicator: "bg-destructive",
  },
};

const TONE_LABEL: Record<string, string> = { BOM: "Bom", REGULAR: "Regular", RUIM: "Ruim" };

interface DashboardSummaryCardsProps {
  overallPercent: number;
  classification: { label: string; tone: Tone };
  categoryBreakdown: { id: string; title: string; percentual: number }[];
  totalNC: number;
  criticalNC: number;
  trendPoints: TrendPoint[];
  trendDeltaLabel: string;
  statusCounts: { finalizadas: number; emAndamento: number; agendadas: number };
}

function StatusRow({ colorClassName, label, count }: { colorClassName: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", colorClassName)} />
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-semibold">{count}</span>
    </div>
  );
}

export function DashboardSummaryCards({
  overallPercent,
  classification,
  categoryBreakdown,
  totalNC,
  criticalNC,
  trendPoints,
  trendDeltaLabel,
  statusCounts,
}: DashboardSummaryCardsProps) {
  const tone = TONE_CLASSES[classification.tone];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="p-6 lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between space-y-0 p-0">
          <CardTitle className="text-base font-semibold">Conformidade Geral</CardTitle>
          <Badge variant="outline" className={cn("border", tone.border, tone.text, tone.bg)}>
            {TONE_LABEL[classification.label] ?? classification.label}
          </Badge>
        </CardHeader>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-5xl font-semibold leading-none">{overallPercent.toFixed(0)}%</span>
        </div>
        <Progress value={overallPercent} className="mt-4 h-2" indicatorClassName={tone.indicator} />

        <div className="mt-6 space-y-3">
          {categoryBreakdown.map((cat) => (
            <div key={cat.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">{cat.title}</span>
                <span className="font-semibold">{cat.percentual.toFixed(0)}%</span>
              </div>
              <Progress value={cat.percentual} className="h-1.5" />
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Não conformidades</p>
          <p className="mt-1 text-3xl font-semibold">{totalNC}</p>
          <p className="mt-1 text-xs font-medium text-destructive">{criticalNC} críticas</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Evolução (últimas)</p>
          <div className="mt-1 h-12">
            {trendPoints.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendPoints}>
                  <Line type="monotone" dataKey="conformidade" stroke="var(--color-success)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center text-xs text-muted-foreground">Sem dados suficientes</div>
            )}
          </div>
          {trendPoints.length >= 2 && (
            <p className="mt-1 text-xs font-medium text-success">{trendDeltaLabel}</p>
          )}
        </Card>

        <Card className="p-5">
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Status</p>
          <div className="space-y-1.5">
            <StatusRow colorClassName="bg-success" label="Finalizadas" count={statusCounts.finalizadas} />
            <StatusRow colorClassName="bg-warning" label="Em andamento" count={statusCounts.emAndamento} />
            <StatusRow colorClassName="bg-primary" label="Agendadas" count={statusCounts.agendadas} />
          </div>
        </Card>
      </div>
    </div>
  );
}
