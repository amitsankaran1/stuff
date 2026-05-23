import { auth } from '@/lib/auth';

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthed = !!req.auth;
  const isLogin = nextUrl.pathname === '/login';

  if (!isAuthed && !isLogin) {
    const url = new URL('/login', nextUrl);
    if (nextUrl.pathname !== '/') url.searchParams.set('next', nextUrl.pathname);
    return Response.redirect(url);
  }
  if (isAuthed && isLogin) {
    return Response.redirect(new URL('/inbox', nextUrl));
  }
});

export const config = {
  // Skip Next internals, static assets, and the auth API itself.
  matcher: ['/((?!api/auth|_next/static|_next/image|icon-.*|manifest.webmanifest|favicon.ico).*)'],
};
