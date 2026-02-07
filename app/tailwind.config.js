"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                emerald: {
                    400: '#34d399',
                    500: '#10b981',
                },
            },
            fontFamily: {
                mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
                sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
            },
            letterSpacing: {
                'wider-2': '0.2em',
            },
        },
    },
    plugins: [require('@tailwindcss/typography')],
};
exports.default = config;
