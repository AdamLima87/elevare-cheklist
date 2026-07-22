import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/elevare/Logo";

export const Route = createFileRoute("/escolha-acesso")({
  head: () => ({
    meta: [{ title: "Onde deseja entrar? · RDCheck" }],
  }),
  component: EscolhaAcessoPage,
});

// Só super_admin chega aqui (login.tsx/index.tsx redirecionam pra cá em
// vez de ir direto pro dashboard). As 2 únicas opções nesta etapa: entrar
// no módulo de plataforma (SaaS, sem tenant ativo) ou entrar na própria
// empresa vinculada ao profile (comportamento de sempre, inalterado).
// Não existe seletor de outros tenants nem impersonação — ver plano.
function EscolhaAcessoPage() {
  const navigate = useNavigate();

  return (
    <ProtectedRoute allowedProfiles={["super_admin"]}>
      <div className="relative flex min-h-screen items-center justify-center bg-paper p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.32_0.07_155_/_0.08),transparent_60%)]" />
        <Card className="w-full max-w-lg overflow-hidden border-slate-200 shadow-lg">
          <CardHeader className="flex flex-col items-center space-y-4 pb-6">
            <div className="mb-2">
              <Logo />
            </div>
            <div className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold text-slate-800">Onde deseja entrar?</CardTitle>
              <CardDescription className="text-slate-500">Escolha o ambiente que quer acessar</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-2">
              <button
                onClick={() => navigate({ to: "/plataforma" })}
                className="group flex flex-col items-center justify-center space-y-3 rounded-xl border-2 border-slate-100 bg-white p-8 text-center transition-all hover:border-[#184878] hover:bg-[#184878]/5"
              >
                <div className="rounded-full bg-slate-50 p-4 transition-colors group-hover:bg-[#184878]/10">
                  <span className="text-3xl" role="img" aria-label="Shield">
                    🛡️
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Administração da Plataforma</h3>
                  <p className="text-xs text-slate-500">Gestão global do RDCheck como SaaS</p>
                </div>
              </button>

              <button
                onClick={() => navigate({ to: "/dashboard" })}
                className="group flex flex-col items-center justify-center space-y-3 rounded-xl border-2 border-slate-100 bg-white p-8 text-center transition-all hover:border-[#184878] hover:bg-[#184878]/5"
              >
                <div className="rounded-full bg-slate-50 p-4 transition-colors group-hover:bg-[#184878]/10">
                  <span className="text-3xl" role="img" aria-label="Office">
                    🏢
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Minha Empresa</h3>
                  <p className="text-xs text-slate-500">Entrar no RDCheck da sua consultoria</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
