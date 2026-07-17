import logoFull from "@/assets/rdcheck-logo-full.png";
import shield from "@/assets/rdcheck-shield.png";

export function Logo({ compact = false }: { compact?: boolean }) {
  const src = compact ? shield : logoFull;
  return (
    <div className="inline-flex items-center justify-center">
      <img
        src={src}
        alt="RDCheck"
        className={`${compact ? "h-10" : "h-14"} w-auto object-contain shrink-0`}
      />
    </div>
  );
}
