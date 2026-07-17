import { useEffect, useState } from "react";
import shield from "@/assets/rdcheck-shield.png";
import { BRAND } from "@/lib/brand";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      const completeTimer = setTimeout(onComplete, 500);
      return () => clearTimeout(completeTimer);
    }, 2400);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-paper transition-opacity duration-500 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Brilho de marca sutil */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.32_0.07_155_/_0.06),transparent_60%)]" />

      <div className="relative flex flex-col items-center">
        {/* Anel de selo atrás do escudo */}
        <div className="relative flex h-40 w-40 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-primary/15 animate-stamp" />
          <div className="absolute inset-3 rounded-full border border-primary/10 animate-stamp [animation-delay:120ms]" />
          <img
            src={shield}
            alt="RDCheck"
            className="relative h-24 w-24 object-contain animate-stamp [animation-delay:180ms]"
          />
        </div>

        <div className="mt-8 flex flex-col items-center">
          <h1
            className="font-display text-3xl font-semibold text-slate-800 opacity-0 animate-in fade-in fill-mode-forwards duration-500 delay-500"
            style={{ letterSpacing: "-0.02em" }}
          >
            {BRAND.name}
          </h1>
          <div className="mt-3 flex items-center gap-3 opacity-0 animate-in fade-in fill-mode-forwards duration-500 delay-700">
            <span className="h-px w-8 bg-primary/40" />
            <p className="label-eyebrow text-primary">
              Checklists Digitais
            </p>
            <span className="h-px w-8 bg-primary/40" />
          </div>
        </div>
      </div>
    </div>
  );
}
