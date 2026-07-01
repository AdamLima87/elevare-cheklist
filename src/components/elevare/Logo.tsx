import logoAsset from "@/assets/elevare-shield.png.asset.json";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-3 ${compact ? "" : "rounded-xl bg-[#0f3d24] px-3 py-2 shadow-sm"}`}>

      <img
        src={logoAsset.url}
        alt="Elevare Consultoria"
        className={`${compact ? "h-10" : "h-12"} w-auto object-contain shrink-0`}
      />
      {!compact && (
        <div className="flex flex-col justify-center leading-none">
          <span className="text-[20px] font-bold text-white tracking-tight lowercase">
            elevare
          </span>
          <span className="text-[9px] uppercase tracking-[0.28em] text-white/90 font-semibold mt-1">
            consultoria
          </span>
        </div>
      )}
    </div>
  );
}
