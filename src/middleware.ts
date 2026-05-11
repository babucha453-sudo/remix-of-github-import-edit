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

const AUTH_REQUIRED_PATHS = [
  '/dashboard',
  '/admin',
  '/appointment/manage',
  '/profile/edit',
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

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW = 60000;

function isBot(userAgent: string): boolean {
  const lowerUA = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => lowerUA.includes(bot.toLowerCase()));
}

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATHS.some(path => pathname.startsWith(path));
}

function isAuthRequiredPath(pathname: string): boolean {
  return AUTH_REQUIRED_PATHS.some(path => pathname.startsWith(path));
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

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  try {
    return decodeURIComponent(
      atob(str)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return atob(str);
  }
}

interface SupabaseSession {
  user: {
    id: string;
    email?: string;
    role?: string;
    app_metadata?: {
      role?: string;
    };
    user_metadata?: Record<string, unknown>;
  };
  exp?: number;
  aal?: string;
  type?: string;
}

async function verifySupabaseSession(request: NextRequest): Promise<SupabaseSession | null> {
  const cookieStore = request.cookies;
  const cookies = cookieStore.getAll();
  
  const authTokenCookie = cookies.find((cookie) => {
    return cookie.name.includes('-auth-token') && !cookie.name.includes('sb-access-token');
  });
  
  if (!authTokenCookie) {
    return null;
  }

  try {
    const tokenValue = authTokenCookie.value;
    const parts = tokenValue.split('.');
    
    if (parts.length < 2) {
      return null;
    }

    const payloadStr = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadStr);

    if (payload.exp) {
      const currentTime = Math.floor(Date.now() / 1000);
      if (payload.exp < currentTime) {
        return null;
      }
    }

    return {
      user: {
        id: payload.sub || payload.user_id || '',
        email: payload.email,
        role: payload.role || payload.app_metadata?.role,
        app_metadata: payload.app_metadata,
        user_metadata: payload.user_metadata,
      },
      exp: payload.exp,
      aal: payload.aal,
      type: payload.type,
    };
  } catch {
    return null;
  }
}

function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientIP);

  if (!record) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (now > record.resetTime) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || '';
  const clientIP = request.headers.get('x-forwarded-for') || 
                   request.headers.get('cf-connecting-ip') || 
                   'unknown';

  if (!checkRateLimit(clientIP)) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      statusText: 'Too Many Requests',
    });
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static') || pathname.startsWith('/assets')) {
    return NextResponse.next();
  }

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (isPrivatePath(pathname)) {
    return NextResponse.next();
  }

  if (isAuthRequiredPath(pathname)) {
    const session = await verifySupabaseSession(request);

    if (!session) {
      const redirectUrl = new URL('/auth', request.url);
      redirectUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (isAdminRoute(pathname)) {
      const userRole = session.user?.role || session.user?.app_metadata?.role;
      
      if (userRole !== 'admin' && userRole !== 'superadmin') {
        const redirectUrl = new URL('/', request.url);
        return NextResponse.redirect(redirectUrl);
      }
    }

    const authResponse = NextResponse.next();
    authResponse.headers.set('x-user-id', session.user?.id || '');
    authResponse.headers.set('x-user-role', session.user?.role || '');
    return authResponse;
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
