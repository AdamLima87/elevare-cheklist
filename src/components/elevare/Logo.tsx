import logoFull from "@/assets/elevare-logo-full.png";
import shield from "@/assets/elevare-shield.png";

export function Logo({ compact = false }: { compact?: boolean }) {
  const src = compact ? shield : logoFull;
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
