export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-6", md: "h-8", lg: "h-12" };
  return (
    <div className="flex items-center gap-2">
      <div className={`${sizes[size]} aspect-square rounded-lg bg-[#1a4d2e] flex items-center justify-center`}>
        <span className="text-white font-bold text-xs">E</span>
      </div>
      <div>
        <div className="font-bold text-[#1a4d2e] leading-none">Elevare</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Segurança dos Alimentos</div>
      </div>
    </div>
  );
}
