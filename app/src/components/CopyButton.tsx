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
      className={`inline-flex items-center gap-2 font-data text-sm text-helix-secondary hover:text-helix-cyan transition-colors ${className}`}
      title={value}
    >
      <span>{truncate ? truncateAddress(value, chars) : value}</span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-helix-green" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
