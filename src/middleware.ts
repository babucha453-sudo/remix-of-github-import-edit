import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BASE_URL = 'https://www.appointpanda.com';
const SUPABASE_FUNCTION_URL = 'https://fnewyocguujowqxyiqsy.supabase.co/functions/v1/serve-static';

const BOT_USER_AGENTS = [
  'googlebot',
  'googleother',
  'google-extended',
  'bingbot',
  'bingpreview',
  'msnbot',
  'yandex',
  'baiduspider',
  'duckduckbot',
  'sogou',
  'exabot',
  'facebot',
  'ia_archiver',
  'applebot',
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'slackbot',
  'telegrambot',
  'discordbot',
  'whatsapp',
  'tiktokbot',
  ' GPTBot',
  'chatgpt-user',
  'claude-web',
  'anthropic-ai',
  'perplexitybot',
  'cohere-ai',
  'ai2bot',
  'anthropic-claude',
  'bytespider',
  'diffbot',
  'mj12bot',
  'sid',
  'spider',
  'crawler',
  'bot/',
  'bot-',
];

const PRIVATE_PATHS = [
  '/admin',
  '/dashboard',
  '/auth',
  '/onboarding',
  '/gmb-select',
  '/claim-profile',
  '/list-your-practice',
  '/book/',
  '/appointment/',
  '/review/',
  '/rq/',
  '/form/',
  '/search',
  '/find-dentist',
  '/api/',
  '/_next',
  '/static',
  '/assets',
];

const STATIC_EXTENSIONS = [
  '.js',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.webp',
  '.avif',
];

function isBot(userAgent: string): boolean {
  const lowerUA = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => lowerUA.includes(bot.toLowerCase()));
}

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATHS.some(path => pathname.startsWith(path));
}

function isStaticAsset(pathname: string): boolean {
  return STATIC_EXTENSIONS.some(ext => pathname.toLowerCase().endsWith(ext));
}

function isIndexablePath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/blog')) return true;
  if (pathname.startsWith('/insurance')) return true;
  if (pathname.startsWith('/services')) return true;
  
  const pathParts = pathname.split('/').filter(Boolean);
  
  if (pathParts.length === 1) {
    const potentialState = pathParts[0];
    if (potentialState && !['about', 'contact', 'faq', 'privacy', 'terms', 'sitemap', 'pricing', 'how-it-works', 'blog', 'services', 'insurance', 'search', 'find-dentist', 'admin', 'auth', 'dashboard'].includes(potentialState)) {
      return true;
    }
  }
  
  if (pathParts.length >= 2) {
    if (pathParts[0] === 'clinic' || pathParts[0] === 'dentist') {
      return true;
    }
    if (!['admin', 'auth', 'dashboard', 'api', 'search'].includes(pathParts[0])) {
      return true;
    }
  }
  
  return false;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || '';

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static') || pathname.startsWith('/assets')) {
    return NextResponse.next();
  }

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (isPrivatePath(pathname)) {
    return NextResponse.next();
  }

  const isBotRequest = isBot(userAgent);

  if (isBotRequest && isIndexablePath(pathname)) {
    const prerenderUrl = `/_prerender?path=${encodeURIComponent(pathname)}&ua=${encodeURIComponent(userAgent)}`;
    
    return NextResponse.rewrite(prerenderUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/:path*',
  ],
};
