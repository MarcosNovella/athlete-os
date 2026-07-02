import type { MetadataRoute } from 'next';

/** Installable PWA (ADR-006/D5). Served at /manifest.webmanifest, auth-exempt in proxy.ts. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Athlete OS',
    short_name: 'Athlete OS',
    description: 'Sistema operativo del atleta — captura, carga y readiness',
    start_url: '/',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#fafafa',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
