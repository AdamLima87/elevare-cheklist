import { Construction } from "lucide-react";

// Placeholder pras seções do módulo de plataforma que ainda não foram
// construídas nesta rodada (Usuários, Integrações, Cobranças, Suporte,
// Configurações) — navegação já existe (Fase 1), conteúdo é fase futura.
export function PlatformStubPage({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{descricao}</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
        <Construction className="h-8 w-8" />
        <p className="text-sm">Em breve.</p>
      </div>
    </div>
  );
}
