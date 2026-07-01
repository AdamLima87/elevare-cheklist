import logoAsset from "@/assets/elevare-logo.png.asset.json";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center">
      <img
        src={logoAsset.url}
        alt="Elevare Consultoria"
        className={`${compact ? "h-9" : "h-11"} w-auto object-contain shrink-0 drop-shadow-sm`}
      />
    </div>
  );
}
