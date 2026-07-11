// Shared Clerk appearance matching the site: near-black bg, emerald accent,
// square corners, geist fonts.
export const clerkAppearance = {
  variables: {
    colorPrimary: '#10b981',
    colorBackground: '#0f0f0f',
    colorInputBackground: '#0a0a0a',
    colorText: '#ffffff',
    colorInputText: '#ffffff',
    colorTextSecondary: 'rgba(255, 255, 255, 0.6)',
    colorNeutral: '#ffffff',
    colorDanger: '#f87171',
    colorSuccess: '#34d399',
    borderRadius: '0px',
    fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
  },
  elements: {
    card: 'border border-white/10 shadow-none',
    formButtonPrimary:
      'bg-emerald-400 text-black hover:bg-emerald-300 text-sm font-medium tracking-widest uppercase',
    footerActionLink: 'text-emerald-400 hover:text-emerald-300',
    headerTitle: 'uppercase tracking-wider-2',
  },
};
