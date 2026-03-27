import posthog from 'posthog-js';

export function initPosthog() {
  if (typeof window === 'undefined') return;
  if (posthog.__loaded) return;

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token) return;

  posthog.init(token, {
    api_host: host || 'https://us.i.posthog.com',
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    enable_heatmaps: true,
    enable_recording_console_log: true,
    session_recording: {
      recordCrossOriginIframes: true,
    },
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') ph.debug();
    },
  });
}

export { posthog };
