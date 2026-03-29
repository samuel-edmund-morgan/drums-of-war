"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

const MESSAGES: Record<string, { text: string; color: string }> = {
  success: { text: "Email verified! Your account is active on all servers. You can now login.", color: "#4ade80" },
  expired: { text: "Verification link expired or invalid. Please register again.", color: "#f87171" },
  invalid: { text: "Invalid verification link.", color: "#f87171" },
  error: { text: "Account creation failed. Please try again.", color: "#f87171" },
};

function ToastInner() {
  const params = useSearchParams();
  const verify = params.get("verify");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (verify && MESSAGES[verify]) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [verify]);

  if (!visible || !verify || !MESSAGES[verify]) return null;

  const { text, color } = MESSAGES[verify];

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 rounded-xl border shadow-2xl max-w-lg text-center animate-in fade-in slide-in-from-top-2"
      style={{ backgroundColor: "#141418", borderColor: color + "40", color }}
    >
      <p className="text-sm font-semibold">{text}</p>
      <button onClick={() => setVisible(false)} className="absolute top-2 right-3 text-[#666] hover:text-white text-xs">
        &#10005;
      </button>
    </div>
  );
}

export default function VerifyToast() {
  return (
    <Suspense>
      <ToastInner />
    </Suspense>
  );
}
