'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  OPEN_SETTINGS_EVENT,
  resolveConsentRequired,
  getStoredConsent,
  setStoredConsent,
  type ConsentValue,
} from '@/lib/consent';
import { initPosthog, optOutPosthog } from '@/lib/posthog';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function updateGtagConsent(value: ConsentValue) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('consent', 'update', {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  });
}

function applyConsent(value: ConsentValue) {
  updateGtagConsent(value);
  if (value === 'granted') initPosthog();
  else optOutPosthog();
}

export default function ConsentManager() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored) {
      applyConsent(stored);
      return;
    }
    let cancelled = false;
    resolveConsentRequired().then((required) => {
      if (cancelled) return;
      if (required) {
        setVisible(true); // EEA/UK: defaults stay denied until the visitor chooses
      } else {
        applyConsent('granted'); // elsewhere: analytics on, no banner
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const open = () => setVisible(true);
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, []);

  const decide = useCallback((value: ConsentValue) => {
    setStoredConsent(value);
    applyConsent(value);
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] p-4 sm:p-6">
      <div className="max-w-2xl mx-auto bg-[#0a0a0a] text-white border border-white/15 shadow-2xl p-5 sm:p-6">
        <p className="text-sm text-white/80 leading-relaxed">
          We use optional analytics cookies to understand how the site is used. You can accept or
          reject them. See our{' '}
          <Link href="/privacy" className="underline text-white hover:text-emerald-400">
            privacy policy
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => decide('granted')}
            className="px-5 py-2 text-xs font-medium tracking-widest bg-emerald-500 text-black hover:bg-emerald-400 transition-colors"
          >
            ACCEPT
          </button>
          <button
            onClick={() => decide('denied')}
            className="px-5 py-2 text-xs font-medium tracking-widest border border-white/20 text-white hover:bg-white/10 transition-colors"
          >
            REJECT
          </button>
        </div>
      </div>
    </div>
  );
}
