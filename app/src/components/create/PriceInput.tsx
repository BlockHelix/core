'use client';

interface PriceInputProps {
  value: number;
  onChange: (value: number) => void;
}

export default function PriceInput({ value, onChange }: PriceInputProps) {
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
        <span className="text-gray-500 font-mono">$</span>
        <input
          type="number"
          min="0.01"
          max="1.00"
          step="0.01"
          value={value.toFixed(2)}
          onChange={handleInputChange}
          className="w-32 bg-white border border-gray-300 px-4 py-3 text-gray-900 font-mono tabular-nums focus:outline-none focus:border-gray-900 transition-colors"
        />
        <span className="text-[10px] uppercase tracking-widest text-gray-400 font-mono">USDC</span>
      </div>

      <div className="flex items-center gap-4">
        <input
          type="range"
          min="0.01"
          max="1.00"
          step="0.01"
          value={value}
          onChange={handleSliderChange}
          className="flex-1 h-1 bg-gray-200 appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:bg-gray-900
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:bg-gray-900
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-pointer"
        />
        <span className="text-xs text-gray-400 font-mono min-w-[80px]">
          $0.01 - $1.00
        </span>
      </div>
    </div>
  );
}
