import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        helix: {
          bg: '#0a0a0f',
          card: '#12121a',
          elevated: '#1a1a28',
          terminal: '#0d1117',
          primary: '#e4e4e7',
          secondary: '#a1a1aa',
          tertiary: '#52525b',
          cyan: '#22d3ee',
          violet: '#a78bfa',
          green: '#4ade80',
          amber: '#fbbf24',
          red: '#f87171',
          border: '#1e1e2e',
          focus: 'rgba(34, 211, 238, 0.2)',
        },
      },
      fontFamily: {
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
