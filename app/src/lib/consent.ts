export const CONSENT_STORAGE_KEY = 'bh_cookie_consent';
export const OPEN_SETTINGS_EVENT = 'bh:open-cookie-settings';

// EEA + UK + Switzerland: consent required before non-essential cookies.
// Used as the region list for Google Consent Mode v2 default-denied.
export const CONSENT_REQUIRED_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'CH',
];

const EUROPEAN_TZ_EXTRA = new Set([
  'Atlantic/Reykjavik', 'Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores',
  'Asia/Nicosia', 'Asia/Famagusta',
]);

export type ConsentValue = 'granted' | 'denied';

// Timezone fallback, only used if the IP lookup below fails.
export function isConsentRequiredByTimezone(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    return tz.startsWith('Europe/') || EUROPEAN_TZ_EXTRA.has(tz);
  } catch {
    return true;
  }
}

// Whether to SHOW the banner, decided by the visitor's IP country so it matches
// Google Consent Mode's IP-based cookie gating. Falls back to timezone if the
// geolocation lookup is unavailable.
export async function resolveConsentRequired(): Promise<boolean> {
  try {
    const res = await fetch('https://get.geojs.io/v1/ip/country.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const cc = String((data && data.country) || '').toUpperCase();
      if (cc) return CONSENT_REQUIRED_REGIONS.includes(cc);
    }
  } catch {
    /* geolocation unavailable */
  }
  return isConsentRequiredByTimezone();
}

export function getStoredConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setStoredConsent(value: ConsentValue): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch {
    /* storage unavailable */
  }
}
