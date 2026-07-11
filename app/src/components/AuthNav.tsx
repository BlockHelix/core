'use client';

import Link from 'next/link';
import { useAuth, UserButton } from '@clerk/nextjs';

const CLERK_ENABLED = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function AuthNav() {
  if (!CLERK_ENABLED) {
    return null;
  }
  return <AuthNavInner />;
}

function AuthNavInner() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="w-7 h-7" />;
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/sign-in"
          className="text-xs uppercase tracking-wider-2 font-medium text-white/60 hover:text-white transition-colors duration-300"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="text-xs uppercase tracking-wider-2 font-medium px-4 py-2 bg-emerald-400 text-black hover:bg-emerald-300 transition-colors duration-300"
        >
          Sign Up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/dashboard"
        className="text-xs uppercase tracking-wider-2 font-medium text-white/60 hover:text-white transition-colors duration-300"
      >
        Dashboard
      </Link>
      <UserButton
        appearance={{
          elements: {
            userButtonAvatarBox: 'w-7 h-7 border border-white/20',
          },
        }}
      />
    </div>
  );
}
