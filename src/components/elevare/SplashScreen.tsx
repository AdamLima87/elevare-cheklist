import { useState, useEffect } from "react";
import logoAsset from "@/assets/elevare-logo.png.asset.json";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Wait for fade out animation before calling onComplete
      const completeTimer = setTimeout(onComplete, 500);
      return () => clearTimeout(completeTimer);
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1a4d2e] transition-opacity duration-500 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex flex-col items-center space-y-4">
        {/* Logo with fade in + scale */}
        <div className="animate-in fade-in zoom-in duration-600">
          <img
            src={logoAsset.url}
            alt="Elevare Consultoria"
            className="h-24 w-24 object-contain brightness-0 invert"
          />
        </div>

        <div className="flex flex-col items-center">
          {/* Main Text with fade in and delay */}
          <h1 className="text-white text-2xl font-bold opacity-0 animate-in fade-in fill-mode-forwards duration-400 delay-500">
            Elevare Consultoria
          </h1>
          
          {/* Subtext with fade in, slide from bottom and delay */}
          <p className="text-[#a0c49d] text-sm uppercase tracking-[0.2em] opacity-0 animate-in fade-in slide-in-from-bottom-4 fill-mode-forwards duration-400 delay-800">
            Segurança dos Alimentos
          </p>
        </div>
      </div>
    </div>
  );
}
