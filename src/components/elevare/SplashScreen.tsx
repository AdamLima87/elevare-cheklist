import { useEffect, useState } from "react";
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => { setVisible(false); setTimeout(onDone, 500); }, 2500);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1a4d2e] transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"}`}>
      <div className="animate-in fade-in zoom-in duration-700 flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center">
          <span className="text-white font-bold text-4xl">E</span>
        </div>
        <div className="text-center">
          <h1 className="text-white text-3xl font-bold">Elevare Consultoria</h1>
          <p className="text-white/70 text-sm mt-1 uppercase tracking-widest">Segurança dos Alimentos</p>
        </div>
      </div>
    </div>
  );
}
