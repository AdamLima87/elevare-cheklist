import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/compliance-trend";

interface ComplianceTrendChartProps {
  data: TrendPoint[];
}

export function ComplianceTrendChart({ data }: ComplianceTrendChartProps) {
  if (data.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {data.length === 0
          ? "Sem inspeções concluídas para mostrar a evolução."
          : "É preciso ao menos duas inspeções concluídas para exibir a evolução."}
      </p>
    );
  }

  const chartData = data.map((p) => ({
    ...p,
    label: new Date(p.date + "T00:00:00").toLocaleDateString("pt-BR"),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <ReferenceLine
            y={76}
            stroke="var(--color-success, #18a860)"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            y={51}
            stroke="var(--color-warning, #f59e0b)"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, "Conformidade"]} />
          <Line
            type="monotone"
            dataKey="conformidade"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
