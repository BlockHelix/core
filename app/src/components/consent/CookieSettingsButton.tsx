'use client';

import { OPEN_SETTINGS_EVENT } from '@/lib/consent';

export default function CookieSettingsButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT))}
      className="text-sm text-white/50 hover:text-white transition-colors"
    >
      Cookie settings
    </button>
  );
}
