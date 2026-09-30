/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cap how long a stale page may be served while revalidation is attempted.
  //
  // Next's default emits `stale-while-revalidate=31535700` — a YEAR. A page whose background
  // revalidation fails then keeps serving from cache indefinitely with nothing to show for it,
  // which is exactly what happened to /agents on 2026-09-30: `x-nextjs-cache: HIT` beside vault
  // ages twelve days out of date, on a page titled "The record". An hour is long enough to
  // absorb an API blip and short enough that a real outage surfaces as an outage.
  expireTime: 3600,
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      path: false,
      os: false,
      crypto: false,
    };
    return config;
  },
};

module.exports = nextConfig;
