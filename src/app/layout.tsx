import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed, Geist_Mono } from 'next/font/google';
import { SwRegister } from '@/core/pwa/SwRegister';
import './globals.css';

const barlow = Barlow({
  variable: '--font-barlow',
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

const barlowCondensed = Barlow_Condensed({
  variable: '--font-barlow-condensed',
  weight: ['500', '600', '700'],
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Athlete OS',
  description: 'Sistema operativo del atleta — captura, carga y readiness',
  appleWebApp: { capable: true, title: 'Athlete OS', statusBarStyle: 'black' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#0b100e',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${barlow.variable} ${barlowCondensed.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-pitch text-chalk">
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
