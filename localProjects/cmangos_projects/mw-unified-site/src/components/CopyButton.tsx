"use client";

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="px-4 py-2 text-sm font-semibold rounded-lg border transition-all cursor-pointer whitespace-nowrap"
      style={{
        borderColor: copied ? "#22c55e" : "#ffa500",
        color: copied ? "#22c55e" : "#ffa500",
        background: copied ? "rgba(34,197,94,0.1)" : "rgba(255,165,0,0.1)",
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
