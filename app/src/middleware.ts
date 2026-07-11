import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedPage = createRouteMatcher(['/dashboard(.*)']);
const isProtectedApi = createRouteMatcher(['/api/vaults(.*)']);

const clerkConfigured =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

const withClerk = clerkMiddleware(async (auth, req) => {
  if (isProtectedApi(req)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  if (isProtectedPage(req)) {
    await auth.protect();
  }
});

// Without Clerk env vars (e.g. a preview build) marketing pages still work;
// protected routes are refused instead of crashing the whole middleware.
export default clerkConfigured
  ? withClerk
  : function middleware(req: Request) {
      const { pathname } = new URL(req.url);
      if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/vaults')) {
        return NextResponse.json({ error: 'Auth is not configured' }, { status: 503 });
      }
      return NextResponse.next();
    };

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
