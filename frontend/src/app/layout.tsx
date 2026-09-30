import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Bengali } from 'next/font/google';
import './globals.css';
import './print.css';
import { Providers } from '../components/Providers';
import { ServiceWorkerRegistrar } from '../components/ServiceWorkerRegistrar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// Bengali glyphs (bangla UI labels) — falls back to the system font if absent
const bengali = Noto_Sans_Bengali({ subsets: ['bengali', 'latin'], variable: '--font-bengali', display: 'swap' });

export const metadata: Metadata = {
  title: 'BDBBC ERP Solution',
  description:
    'One software to run many organizations — POS, Sales, Purchase, Inventory, Accounting, HR, Production, CRM and eCommerce',
  manifest: '/manifest.webmanifest',
  applicationName: 'BDBBC ERP',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
  appleWebApp: {
    capable: true,
    title: 'BDBBC ERP',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bn" className="dark">
      <body className={`${inter.className} ${bengali.variable} bg-slate-950 text-slate-100 antialiased`}>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
