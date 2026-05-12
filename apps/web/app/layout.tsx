import type { Metadata } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

const beVietnamPro = Be_Vietnam_Pro({
  variable: '--font-sans',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Concord — Couple Finance Agent',
  description:
    'Track expenses across personal + joint funds. Hit your savings goals with an AI agent.',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${beVietnamPro.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-stone-50 font-sans text-stone-900">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
