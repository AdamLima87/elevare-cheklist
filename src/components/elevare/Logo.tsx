import logoAsset from "@/assets/elevare-logo.png.asset.json";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={logoAsset.url}
        alt="Elevare Consultoria"
        className="h-9 w-9 object-contain shrink-0 drop-shadow-sm"
      />
      {!compact && (
        <div className="flex flex-col justify-center leading-none">
          <span className="text-[18px] font-bold text-white tracking-[-0.02em] lowercase">
            elevare
          </span>
          <span className="text-[8px] uppercase tracking-[0.32em] text-white/70 font-semibold mt-1">
            consultoria
          </span>
        </div>
      )}
    </div>
  );
}
