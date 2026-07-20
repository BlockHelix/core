// Light auth surface (enterprise look) with the site's emerald accent.
// Clerk's default theme is light, so we only tune the accent + brand details;
// the card floats on the site's white background.
export const clerkAppearance = {
  variables: {
    colorPrimary: '#059669',
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
      'bg-emerald-600 text-white hover:bg-emerald-500 text-sm font-medium tracking-widest uppercase',
    footerActionLink: 'text-emerald-600 hover:text-emerald-500',
    headerTitle: 'uppercase tracking-wider',
  },
};
