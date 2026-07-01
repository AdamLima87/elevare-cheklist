import logoAsset from "@/assets/elevare-logo-full.png.asset.json";
import shieldAsset from "@/assets/elevare-shield.png.asset.json";

export function Logo({ compact = false }: { compact?: boolean }) {
  const src = compact ? shieldAsset.url : logoAsset.url;
  return (
    <div className="inline-flex items-center justify-center">
      <img
        src={src}
        alt="Elevare Consultoria"
        className={`${compact ? "h-10" : "h-14"} w-auto object-contain shrink-0`}
      />
    </div>
  );
}
