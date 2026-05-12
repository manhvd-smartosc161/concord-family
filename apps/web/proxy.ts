import { NextRequest, NextResponse } from 'next/server';

const LOCALES = ['vi', 'en'] as const;
const DEFAULT_LOCALE = 'vi';

export function proxy(req: NextRequest) {
  const cookie = req.cookies.get('NEXT_LOCALE')?.value;
  const locale = LOCALES.includes(cookie as (typeof LOCALES)[number])
    ? (cookie as string)
    : DEFAULT_LOCALE;

  const res = NextResponse.next();
  res.headers.set('x-next-intl-locale', locale);
  return res;
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'],
};
