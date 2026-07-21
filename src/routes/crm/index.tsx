import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/elevare/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, CalendarClock, Compass, Send, TrendingDown, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import {
  useCrmMesaDeTrabalho,
  type CrmMesaLead,
  type CrmMesaAtividade,
  type CrmMesaOportunidade,
} from "@/hooks/useCrmMesaDeTrabalho";
import { CrmGlobalSearch } from "@/components/crm/CrmGlobalSearch";

export const Route = createFileRoute("/crm/")({
  head: () => ({
    meta: [
      { title: "Mesa de Trabalho · CRM Comercial · RDCheck" },
      { name: "description", content: "Triagem diária do CRM Comercial." },
    ],
  }),
  component: CrmMesaDeTrabalhoPage,
});

function CrmMesaDeTrabalhoPage() {
  const { data: profile } = useCurrentProfile();
  const { data: mesa, isLoading } = useCrmMesaDeTrabalho();
  const [escopo, setEscopo] = useState<"minhas" | "equipe">("minhas");
  const meuId = profile?.userId;

  const filtrado = useMemo(() => {
    if (!mesa) return null;
    if (escopo === "equipe") return mesa;
    return {
      leadsSemContato: mesa.leadsSemContato.filter((l) => l.responsavel_id === meuId),
      atividadesAtrasadas: mesa.atividadesAtrasadas.filter((a) => a.responsavel_id === meuId),
      followUpsHoje: mesa.followUpsHoje.filter((a) => a.responsavel_id === meuId),
      oportunidadesSemProximaAcao: mesa.oportunidadesSemProximaAcao.filter((o) => o.responsavel_id === meuId),
      propostasAguardando: mesa.propostasAguardando.filter((o) => o.responsavel_id === meuId),
      negociacoesEstagnadas: mesa.negociacoesEstagnadas.filter((o) => o.responsavel_id === meuId),
    };
  }, [mesa, escopo, meuId]);

  return (
    <ProtectedRoute allowedProfiles={["admin", "consultor"]}>
      <AppShell>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Mesa de Trabalho</h1>
            <p className="text-sm text-muted-foreground">O que precisa da sua atenção hoje.</p>
          </div>
          <CrmGlobalSearch />
        </div>

        <div className="mb-4 inline-flex rounded-lg border border-border p-1">
          <Button
            variant={escopo === "minhas" ? "default" : "ghost"}
            size="sm"
            onClick={() => setEscopo("minhas")}
          >
            Minhas
          </Button>
          <Button
            variant={escopo === "equipe" ? "default" : "ghost"}
            size="sm"
            onClick={() => setEscopo("equipe")}
          >
            Equipe
          </Button>
        </div>

        {isLoading || !filtrado ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <MesaSecaoLeads
              icone={<UserX className="h-4 w-4" />}
              titulo="Leads sem primeiro contato"
              itens={filtrado.leadsSemContato}
            />
            <MesaSecaoAtividade
              icone={<AlertTriangle className="h-4 w-4 text-destructive" />}
              titulo="Atividades atrasadas"
              itens={filtrado.atividadesAtrasadas}
            />
            <MesaSecaoAtividade
              icone={<CalendarClock className="h-4 w-4" />}
              titulo="Follow-ups de hoje"
              itens={filtrado.followUpsHoje}
            />
            <MesaSecaoOportunidade
              icone={<Compass className="h-4 w-4" />}
              titulo="Oportunidades sem próxima atividade"
              itens={filtrado.oportunidadesSemProximaAcao}
            />
            <MesaSecaoOportunidade
              icone={<Send className="h-4 w-4" />}
              titulo="Propostas aguardando resposta"
              itens={filtrado.propostasAguardando}
            />
            <MesaSecaoOportunidade
              icone={<TrendingDown className="h-4 w-4 text-destructive" />}
              titulo="Negociações estagnadas"
              itens={filtrado.negociacoesEstagnadas}
            />
          </div>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}

function SecaoCard({
  icone,
  titulo,
  quantidade,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  quantidade: number;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {icone}
          {titulo}
        </CardTitle>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            quantidade > 0 ? "bg-muted text-foreground" : "bg-muted/50 text-muted-foreground",
          )}
        >
          {quantidade}
        </span>
      </CardHeader>
      <CardContent className="space-y-1.5">{children}</CardContent>
    </Card>
  );
}

function EmptyRow() {
  return <p className="py-4 text-center text-sm text-muted-foreground">Nada por aqui. 🎉</p>;
}

function MesaSecaoLeads({
  icone,
  titulo,
  itens,
}: {
  icone: React.ReactNode;
  titulo: string;
  itens: CrmMesaLead[];
}) {
  const navigate = useNavigate();
  return (
    <SecaoCard icone={icone} titulo={titulo} quantidade={itens.length}>
      {itens.length === 0 ? (
        <EmptyRow />
      ) : (
        itens.map((l) => (
          <button
            key={l.id}
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
            onClick={() => navigate({ to: "/crm/empresas/$id", params: { id: l.id } })}
          >
            <span className="truncate font-medium">{l.nome_fantasia || l.razao_social}</span>
          </button>
        ))
      )}
    </SecaoCard>
  );
}

function MesaSecaoAtividade({
  icone,
  titulo,
  itens,
}: {
  icone: React.ReactNode;
  titulo: string;
  itens: CrmMesaAtividade[];
}) {
  const navigate = useNavigate();
  return (
    <SecaoCard icone={icone} titulo={titulo} quantidade={itens.length}>
      {itens.length === 0 ? (
        <EmptyRow />
      ) : (
        itens.map((a) => (
          <button
            key={a.id}
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
            onClick={() => navigate({ to: "/crm/empresas/$id", params: { id: a.crm_empresa_id } })}
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{a.crm_tipos_atividade?.nome ?? "Atividade"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {a.crm_empresas?.nome_fantasia || a.crm_empresas?.razao_social}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {new Date(a.vencimento).toLocaleDateString("pt-BR")}
            </span>
          </button>
        ))
      )}
    </SecaoCard>
  );
}

function MesaSecaoOportunidade({
  icone,
  titulo,
  itens,
}: {
  icone: React.ReactNode;
  titulo: string;
  itens: CrmMesaOportunidade[];
}) {
  const navigate = useNavigate();
  return (
    <SecaoCard icone={icone} titulo={titulo} quantidade={itens.length}>
      {itens.length === 0 ? (
        <EmptyRow />
      ) : (
        itens.map((o) => (
          <button
            key={o.id}
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
            onClick={() => navigate({ to: "/crm/empresas/$id", params: { id: o.crm_empresa_id } })}
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{o.nome}</p>
              <p className="truncate text-xs text-muted-foreground">
                {o.crm_empresas?.nome_fantasia || o.crm_empresas?.razao_social}
              </p>
            </div>
          </button>
        ))
      )}
    </SecaoCard>
  );
}
