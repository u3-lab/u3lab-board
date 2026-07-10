import { NextRequest, NextResponse } from 'next/server';

// Stopgap auth gate for u3lab-board (Vercel's paid Deployment Protection is not
// available on the current plan). Agent-to-agent calls carry a shared secret
// header; browser access falls back to HTTP Basic Auth.
// See saku memory: project_board_auth_exposure_c1.md

const AGENT_BYPASS_SECRET = process.env.AGENT_BYPASS_SECRET;
const BASIC_AUTH_USER = process.env.BOARD_BASIC_AUTH_USER;
const BASIC_AUTH_PASS = process.env.BOARD_BASIC_AUTH_PASS;

export function middleware(req: NextRequest) {
  if (AGENT_BYPASS_SECRET && req.headers.get('x-vercel-protection-bypass') === AGENT_BYPASS_SECRET) {
    return NextResponse.next();
  }

  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const sepIndex = decoded.indexOf(':');
    const user = decoded.slice(0, sepIndex);
    const pass = decoded.slice(sepIndex + 1);
    if (BASIC_AUTH_USER && BASIC_AUTH_PASS && user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASS) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="U3LAB Board"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
