import { createFileRoute, Link } from "@tanstack/react-router";
export const Route = createFileRoute("/acesso-negado")({ component: AcessoNegado });
function AcessoNegado() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">Acesso negado</h1>
        <p className="text-slate-500">Você não tem permissão para acessar esta página.</p>
        <Link to="/login" className="inline-block px-4 py-2 bg-[#1a4d2e] text-white rounded-lg">Voltar ao início</Link>
      </div>
    </div>
  );
}
