'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check, X, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

type CheckRow = { label: string; detail: string; ok: boolean; flag?: boolean };
type Scenario = {
  endpoint: string;
  trade: string;
  rows: CheckRow[];
  result: { verdict: 'pass' | 'held' | 'risk'; text: string };
};

const SCENARIOS: Scenario[] = [
  {
    endpoint: 'POST /v1/vaults/0x8f3a/position/lever',
    trade: 'lever USDC carry · +1,500,000 notional',
    rows: [
      { label: 'net carry', detail: '+247 bps · 8.1% − 5.6%', ok: true },
      { label: 'health factor', detail: '1.84 ≥ 1.50 floor', ok: true },
      { label: 'leverage', detail: '2.6× ≤ 3.0× cap', ok: true },
      { label: 'liq. buffer', detail: '−21% before liquidation', ok: true },
      { label: 'exit', detail: 'unwind ≤ 40 bps · 1 block', ok: true },
      { label: 'nav', detail: '−1 bp · conserved', ok: true },
    ],
    result: { verdict: 'pass', text: 'SETTLED ON-CHAIN · 0x4a2b…9c1d' },
  },
  {
    endpoint: 'POST /v1/vaults/0x8f3a/position/rotate',
    trade: 'rotate 1,200,000 USDC → 11.2% APY market',
    rows: [
      { label: 'mandate', detail: 'USDC market · allowlisted', ok: true },
      { label: 'net carry', detail: 'yld 11.2% < cost 13.8%', ok: false, flag: true },
      { label: 'health factor', detail: '1.72 ≥ 1.50 floor', ok: true },
      { label: 'leverage', detail: '2.9× ≤ 3.0× cap', ok: true },
      { label: 'exit', detail: 'unwind ≤ 55 bps · 1 block', ok: true },
      { label: 'nav', detail: '±0 bps · conserved', ok: true },
    ],
    result: { verdict: 'held', text: 'HELD · NEEDS APPROVAL' },
  },
  {
    endpoint: 'POST /v1/vaults/0x8f3a/trade/swap',
    trade: 'swap 3,840,000 USDC → USDe',
    rows: [
      { label: 'asset mandate', detail: 'USDe · stable-allowlist', ok: true },
      { label: 'peg deviation', detail: 'USDe 0.9871 · 129 > 50 bps', ok: false },
      { label: 'oracle dev.', detail: 'exec 34 bps off mid', ok: true },
      { label: 'concentration', detail: '→ 34% TVL > 25% cap', ok: false },
      { label: 'exit liquidity', detail: 'unwind ≥ 180 bps', ok: false },
      { label: 'nav', detail: '−129 bps · −$49k', ok: false },
    ],
    result: { verdict: 'risk', text: 'HIGH RISK · CO-SIGN TO PROCEED' },
  },
];

const ROW_MS = 550;
const RESULT_MS = 500;
const HOLD_MS = 2600;

// Loops a simulated policy check: each economic bound ticks through, then the
// trade auto-executes or holds for co-sign. Three actions: a levered carry the
// engine clears, negative carry it holds for approval, and a depegging asset it
// flags high-risk. Nothing hard-reverts; the operator can always co-sign.
export default function PolicyCheckCard() {
  const reduced = useReducedMotion();
  const [round, setRound] = useState(0);
  // step 0..rows.length = rows revealed; step > rows.length = result shown
  const [step, setStep] = useState(0);

  const scenario = SCENARIOS[round % SCENARIOS.length];
  const total = scenario.rows.length;

  useEffect(() => {
    if (reduced) return;
    if (step > total) {
      const t = setTimeout(() => {
        setStep(0);
        setRound((r) => r + 1);
      }, HOLD_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), step === total ? RESULT_MS : ROW_MS);
    return () => clearTimeout(t);
  }, [step, total, reduced]);

  const rowsVisible = reduced ? total : Math.min(step, total);
  const resultVisible = reduced || step > total;

  return (
    <div className="bg-white border border-gray-200 shadow-xl w-full max-w-md mx-auto lg:mx-0">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <span className="text-[10px] uppercase tracking-widest text-gray-400 font-mono">
          Policy check
        </span>
        <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-mono text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 status-pulse" />
          simulated
        </span>
      </div>

      <div className="px-5 py-4 border-b border-gray-100 font-mono">
        <p className="text-[11px] text-gray-400 truncate">{scenario.endpoint}</p>
        <p className="text-sm text-gray-900 mt-1">{scenario.trade}</p>
      </div>

      {/* Fixed height so the card doesn't jump between scenarios */}
      <div className="px-5 py-4 min-h-[292px] flex flex-col">
        <div className="space-y-3">
          {scenario.rows.slice(0, rowsVisible).map((row, i) => (
            <motion.div
              key={`${round}-${row.label}`}
              initial={reduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex items-center justify-between gap-4"
            >
              <span className="flex items-center gap-2.5">
                {row.ok ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
                ) : row.flag ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" strokeWidth={2.5} />
                ) : (
                  <X className="w-3.5 h-3.5 text-red-500" strokeWidth={3} />
                )}
                <span className="text-xs font-mono text-gray-900">{row.label}</span>
              </span>
              <span className={`text-xs font-mono ${row.ok ? 'text-gray-400' : row.flag ? 'text-amber-600' : 'text-red-600'}`}>
                {row.detail}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="mt-auto pt-4">
          {resultVisible && (
            <motion.div
              key={`result-${round}`}
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={`px-4 py-3 text-xs font-mono font-semibold tracking-wider border ${
                scenario.result.verdict === 'pass'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : scenario.result.verdict === 'held'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {scenario.result.text}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
