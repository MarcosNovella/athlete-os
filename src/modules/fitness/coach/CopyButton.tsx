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
      className="w-full rounded-xl bg-zinc-900 p-3.5 font-medium text-white active:scale-[0.99]"
    >
      {copied ? 'Copiado ✓ — pegalo en claude.ai' : 'Copiar briefing para la IA'}
    </button>
  );
}
