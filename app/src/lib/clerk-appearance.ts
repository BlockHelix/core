// Light auth surface (enterprise look) with the site's emerald accent.
// Clerk's default theme is light, so we only tune the accent + brand details;
// the card floats on the site's white background.
export const clerkAppearance = {
  variables: {
    colorPrimary: '#10c689',
    colorText: '#0a0a0a',
    colorTextSecondary: '#52525b',
    colorBackground: '#ffffff',
    colorInputBackground: '#ffffff',
    colorInputText: '#0a0a0a',
    borderRadius: '4px',
    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
  },
  elements: {
    card: 'border border-black/10 shadow-xl',
    formButtonPrimary:
      'bg-[#10c689] text-white hover:bg-[#10c689] text-sm font-medium tracking-widest uppercase',
    footerActionLink: 'text-[#10c689] hover:text-[#10c689]',
    headerTitle: 'uppercase tracking-wider',
  },
};
