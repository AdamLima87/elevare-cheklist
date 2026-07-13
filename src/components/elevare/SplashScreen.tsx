import { useEffect, useState } from "react";
import shield from "@/assets/elevare-shield.png";

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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-forest-grain transition-opacity duration-500 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,oklch(0.14_0.04_155_/_0.55)_100%)]" />

      <div className="relative flex flex-col items-center">
        {/* Seal ring behind logo */}
        <div className="relative flex h-40 w-40 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-white/20 animate-stamp" />
          <div className="absolute inset-3 rounded-full border border-white/10 animate-stamp [animation-delay:120ms]" />
          <img
            src={shield}
            alt="Elevare Consultoria"
            className="relative h-24 w-24 object-contain brightness-0 invert animate-stamp [animation-delay:180ms]"
          />
        </div>

        <div className="mt-8 flex flex-col items-center">
          <h1
            className="font-display text-3xl font-semibold text-white opacity-0 animate-in fade-in fill-mode-forwards duration-500 delay-500"
            style={{ letterSpacing: "-0.02em" }}
          >
            Elevare Consultoria
          </h1>
          <div className="mt-3 flex items-center gap-3 opacity-0 animate-in fade-in fill-mode-forwards duration-500 delay-700">
            <span className="h-px w-8 bg-[color:var(--olive)]/60" />
            <p className="label-eyebrow text-[color:var(--olive)]">
              Segurança dos Alimentos
            </p>
            <span className="h-px w-8 bg-[color:var(--olive)]/60" />
          </div>
        </div>
      </div>
    </div>
  );
}
