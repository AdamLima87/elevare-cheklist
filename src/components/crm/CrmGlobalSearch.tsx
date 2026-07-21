import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Building2, User } from "lucide-react";
import { useCrmSearch } from "@/hooks/useCrmSearch";

export function CrmGlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: resultados = [], isFetching } = useCrmSearch(query);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (crmEmpresaId: string) => {
    setOpen(false);
    setQuery("");
    navigate({ to: "/crm/empresas/$id", params: { id: crmEmpresaId } });
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-96">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Buscar por empresa, CNPJ, contato, telefone, cidade..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="pl-9"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg">
          {isFetching ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">Nada encontrado.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {resultados.map((r) => (
                <button
                  key={`${r.tipo}-${r.id}`}
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted/60"
                  onClick={() => handleSelect(r.crm_empresa_id)}
                >
                  {r.tipo === "conta" ? (
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.titulo}</p>
                    {r.subtitulo && <p className="truncate text-xs text-muted-foreground">{r.subtitulo}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
