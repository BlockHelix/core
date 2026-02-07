'use client';

interface PriceInputProps {
  value: number;
  onChange: (value: number) => void;
  dark?: boolean;
}

export default function PriceInput({ value, onChange, dark }: PriceInputProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      onChange(Math.max(0.01, Math.min(1.0, newValue)));
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={dark ? 'text-white/50 font-mono' : 'text-gray-500 font-mono'}>$</span>
        <input
          type="number"
          min="0.01"
          max="1.00"
          step="0.01"
          value={value.toFixed(2)}
          onChange={handleInputChange}
          className={dark
            ? 'w-32 bg-white/5 border border-white/10 px-4 py-3 text-white font-mono tabular-nums focus:outline-none focus:border-white/30 transition-colors'
            : 'w-32 bg-white border border-gray-300 px-4 py-3 text-gray-900 font-mono tabular-nums focus:outline-none focus:border-gray-900 transition-colors'
          }
        />
        <span className={dark
          ? 'text-[10px] uppercase tracking-widest text-white/40 font-mono'
          : 'text-[10px] uppercase tracking-widest text-gray-400 font-mono'
        }>USDC</span>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="range"
          min="0.01"
          max="1.00"
          step="0.01"
          value={value}
          onChange={handleSliderChange}
          className={dark
            ? `flex-1 h-1 bg-white/10 appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:bg-white
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-pointer`
            : `flex-1 h-1 bg-gray-200 appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:bg-gray-900
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:bg-gray-900
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-pointer`
          }
        />
        <span className={dark
          ? 'text-xs text-white/40 font-mono min-w-[80px]'
          : 'text-xs text-gray-400 font-mono min-w-[80px]'
        }>
          $0.01 - $1.00
        </span>
      </div>
    </div>
  );
}
