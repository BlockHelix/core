'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { truncateAddress } from '@/lib/format';

interface CopyButtonProps {
  value: string;
  truncate?: boolean;
  chars?: number;
  className?: string;
}

export function CopyButton({ value, truncate = true, chars = 4, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 font-mono text-sm text-white/60 hover:text-emerald-400 transition-colors duration-300 ${className}`}
      title={value}
    >
      <span className="tabular-nums">{truncate ? truncateAddress(value, chars) : value}</span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
