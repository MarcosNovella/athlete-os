'use client';

import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="w-full rounded-lg bg-flood p-3.5 font-semibold text-pitch active:brightness-90"
    >
      {copied ? 'Copiado ✓ — pegalo en claude.ai' : 'Copiar briefing para la IA'}
    </button>
  );
}
