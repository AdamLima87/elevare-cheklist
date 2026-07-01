export function Logo({ size = "md", compact = false }: { size?: "sm" | "md" | "lg"; compact?: boolean }) {
  const sizes = { sm: "h-6", md: "h-8", lg: "h-12" };
  return (
    <div className="flex items-center gap-2">
      <div className={`${sizes[size]} aspect-square rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0`}>
        <span className="text-white font-bold text-xs">E</span>
      </div>
      {!compact && (
        <div>
          <div className="font-bold text-white leading-none">Elevare</div>
          <div className="text-[10px] text-white/70 uppercase tracking-wider">Segurança dos Alimentos</div>
        </div>
      )}
    </div>
  );
}
