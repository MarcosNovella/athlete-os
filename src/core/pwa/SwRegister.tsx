'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (R1: browser API needs a client island).
 * Production only: in dev, cached hashed assets go stale on every rebuild.
 */
export function SwRegister(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failure only means no offline shell; the app still works online.
    });
  }, []);
  return null;
}
